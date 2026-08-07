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
  let chunks: { en: string; pt: string }[] = [];
  let level = session.profile.target_level;

  if (parsed.data.lessonId) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("id, level, situation, chunks, extensions, week_number, is_published")
      .eq("id", parsed.data.lessonId)
      .maybeSingle();

    if (lesson?.is_published) {
      level = lesson.level;
      circuitNumber = lesson.week_number;
      chunks = (lesson.chunks ?? []).slice(0, 8);
      const ext = lesson.extensions as { live_prompt?: string } | null;
      scenario = scenario || ext?.live_prompt || lesson.situation || "";
    }
  }

  if (!scenario) {
    scenario =
      "Free conversation. Start by asking the student how their day is going, then follow wherever the conversation leads.";
  }

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
    const message = error instanceof Error ? error.message : "Erro desconhecido";
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
