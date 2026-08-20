import { GoogleGenAI, Modality } from "@google/genai";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  ACCESS_DENIAL_HTTP_STATUS,
  ACCESS_DENIAL_MESSAGE,
  getPaidSession,
} from "@/lib/auth/guards";
import { geminiModels, serverEnv } from "@/lib/env";
import { liveSystemPrompt, MODO_LIVE_PADRAO } from "@/lib/gemini/live-prompt";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  lessonId: z.string().uuid().nullish(),
  scenario: z.string().trim().max(4000).nullish(),
  /**
   * Handle de retomada devolvido pelo servidor na sessão anterior. Com token
   * efêmero, a config das `liveConnectConstraints` PREVALECE sobre a que o
   * cliente envia no connect: passar o handle só no browser não retoma nada
   * (verificado contra a API). Por isso ele sobe até aqui.
   */
  resumeHandle: z.string().trim().max(512).nullish(),
  /**
   * Modo da Emma. Sobe a cada pedido de token — inclusive nas reconexões —
   * porque a instrução de sistema é montada aqui: sem isto, a troca de conexão
   * dos 10 minutos devolveria a Emma ao modo padrão no meio da conversa.
   */
  mode: z.enum(["professora", "conversa"]).nullish(),
});

/**
 * Emite um token efêmero para o browser abrir a sessão de voz direto com o
 * Gemini, sem passar a GEMINI_API_KEY para o cliente.
 *
 * O token vale um único uso e expira em 2 minutos: tempo de abrir a conexão,
 * não de ser reaproveitado por terceiros.
 */
export async function POST(request: NextRequest) {
  // Cada token aberto vira minutos de Gemini Live faturados: o paywall precisa
  // valer aqui, não só na página que chama esta rota.
  const auth = await getPaidSession();
  if (!auth.ok) {
    return NextResponse.json(
      { error: ACCESS_DENIAL_MESSAGE[auth.reason] },
      { status: ACCESS_DENIAL_HTTP_STATUS[auth.reason] },
    );
  }
  const session = auth.session;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // corpo opcional
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  // Contexto pedagógico: o roteiro da lição, quando houver.
  let scenario = parsed.data.scenario?.trim() ?? "";
  let circuitNumber: number | null = null;
  let dayNumber: number | null = null;
  let chunks: { en: string; pt: string }[] = [];
  /**
   * O nível da LIÇÃO, não a meta do perfil.
   *
   * `profiles.target_level` é onde o aluno quer chegar e vem com `B1` por
   * padrão — usá-lo colocava um iniciante do circuito 1 recebendo aula em
   * ritmo B1 no primeiro dia. `lessons.level` é onde ele está: A1.1 no começo,
   * B2.2 no fim. O perfil só entra quando não há lição (conversa avulsa).
   */
  let level = session.profile.target_level;

  if (parsed.data.lessonId) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select(
        "id, level, situation, chunks, extensions, week_number, circuit_day, day_number, is_published",
      )
      .eq("id", parsed.data.lessonId)
      .maybeSingle();

    if (lesson?.is_published) {
      level = lesson.level;
      circuitNumber = lesson.week_number;
      dayNumber = lesson.circuit_day;
      chunks = (lesson.chunks ?? []).slice(0, 8);
      const ext = lesson.extensions as { live_prompt?: string } | null;
      scenario = scenario || ext?.live_prompt || lesson.situation || "";
    }
  }

  if (!scenario) {
    scenario =
      "Free conversation. Start by asking the student how their day is going, then follow wherever the conversation leads.";
  }

  /**
   * O RAG chegou a sair daqui, e a justificativa não se sustentou.
   *
   * Foi removido junto com metade do prompt, na hipótese de que instrução de
   * sistema grande era o que deixava a Emma lenta. A bancada desmentiu: uma
   * instrução do mesmo tamanho, feita só de prosa que não pede nada, abre a
   * boca em 4 s enquanto a de produção levava de 15 a 56 s. O custo era o
   * modelo DELIBERAR, e quem resolveu isso foi o `thinkingBudget: 0` lá
   * embaixo. Material de referência é barato — então ele volta.
   */
  let ragContext = "";
  try {
    const { buildContextBlock } = await import("@/lib/gemini/rag");
    const { retrieveContext } = await import("@/lib/gemini/tutor");
    const ragChunks = await retrieveContext(scenario, null, 3);
    if (ragChunks.length) {
      ragContext = buildContextBlock(ragChunks);
    }
  } catch (e) {
    console.warn("[live/token] Falha ao carregar RAG para conversa ao vivo:", e);
  }

  const systemInstruction = liveSystemPrompt({
    // Professora é o padrão: é a Emma que ensina, e foi o que o dono do
    // produto pediu. "conversa" existe para quando o aluno quiser só rodagem.
    modo: parsed.data.mode ?? MODO_LIVE_PADRAO,
    level,
    scenario,
    chunks,
    ragContext,
    circuito: circuitNumber,
    dia: dayNumber,
  });

  try {
    const ai = new GoogleGenAI({
      apiKey: serverEnv.geminiApiKey,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const now = Date.now();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        // Janela para abrir a conexão.
        newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
        // Duração máxima da sessão em si.
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: geminiModels.live,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
            },
            /**
             * ==================================================================
             * A EMMA NÃO PENSA ANTES DE FALAR — e é isso que a fez funcionar
             * ==================================================================
             * O modelo delibera antes de cada turno, por padrão. Numa tarefa de
             * texto isso é qualidade. Numa conversa por voz é o aluno olhando
             * para a tela em silêncio sem saber se quebrou alguma coisa.
             *
             * E deliberar custa proporcional à complexidade do que se pede. Esta
             * instrução de sistema pede uma AULA: abrir anunciando o objetivo,
             * ensinar cada expressão numa ordem, escolher a correção certa entre
             * quatro prioridades, respeitar o regime de língua do nível, limitar
             * a uma correção por turno. Cada fala do aluno disparava tudo isso
             * antes de sair som.
             *
             * Medido contra a API, mesma instrução, corridas intercaladas para
             * pegarem o mesmo servidor:
             *
             *                        abertura        resposta ao aluno   falhas
             *   deliberando (antes)  34 s (até 70 s)  5 s ou nunca        4 de 5
             *   thinkingBudget: 0     1,6 s            1,5 s              0 de 5
             *
             * Vinte vezes mais rápido para abrir a boca, e o turno do aluno
             * passou a fechar sempre. Era isto que o dono do produto descrevia
             * como "não reconhece quando eu finalizei minha fala" e "a fala dela
             * está extremamente lenta": ela não estava lenta, estava pensando.
             *
             * Conversar não é tarefa de raciocínio. A pedagogia está na instrução
             * acima, que ela lê inteira de qualquer forma — o que sai é o
             * intervalo de deliberação, não o que ela sabe fazer.
             */
            thinkingConfig: { thinkingBudget: 0 },
            /**
             * ===================================================================
             * NÃO EXISTE `realtimeInputConfig` AQUI, E É DE PROPÓSITO
             * ===================================================================
             * Havia. Três parâmetros de VAD escolhidos no papel para deixar a
             * conversa mais fluida: `silenceDurationMs: 500`,
             * `endOfSpeechSensitivity: HIGH` e `startOfSpeechSensitivity`, que
             * chegou a ser HIGH e depois LOW.
             *
             * Medido contra a API de verdade, com fala real e o mesmo aparato
             * em todas as corridas (`scripts/_live-bancada.ts`), mexer nisso é
             * o que quebrava a sala:
             *
             *   START_LOW    o servidor não ouvia o aluno. Nem o começo da
             *                fala: seis corridas seguidas transcreveram NADA.
             *   START_HIGH   instável — uma corrida entregou o áudio a 0,52x o
             *                tempo real, com buraco de 1965 ms no meio de uma
             *                frase, e outra levou 47 s para perceber que o
             *                aluno tinha parado de falar.
             *   sem nada     lacuna de 41 a 73 ms dentro da fala, fim de turno
             *                em 2,5 a 2,8 s, e ouviu o aluno em todas.
             *
             * O padrão do servidor é afinado junto com o modelo. Estes três
             * botões existem para casos que não são o nosso, e girá-los às
             * cegas custou ao aluno uma sala que não funcionava.
             */
            // Habilita os handles de retomada. O servidor encerra a sessão por
            // volta dos 10 min (e antes disso se o áudio parar de fluir); sem
            // isto, a reconexão do cliente começaria uma conversa em branco e a
            // tutora esqueceria tudo o que o aluno tinha acabado de dizer.
            sessionResumption: parsed.data.resumeHandle
              ? { handle: parsed.data.resumeHandle }
              : {},
          },
        },
      },
    });

    if (!token.name) throw new Error("Token efêmero sem nome");

    return NextResponse.json({
      token: token.name,
      model: geminiModels.live,
      circuitNumber,
      expiresAt: new Date(now + 30 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[live/token]", message);

    const quota = /quota|429|rate.?limit/i.test(message);
    return NextResponse.json(
      {
        error: quota
          ? "Limite de conversas ao vivo atingido. Tente mais tarde."
          : "Não foi possível abrir a sala de conversa.",
        detail: message.slice(0, 200),
      },
      { status: quota ? 429 : 502 },
    );
  }
}
