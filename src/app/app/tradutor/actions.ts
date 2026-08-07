"use server";

import { Type, type Schema } from "@google/genai";
import { z } from "zod";

import { requireActiveUser } from "@/lib/auth/guards";
import { geminiModels } from "@/lib/env";
import { gemini, parseJsonResponse, withRetry } from "@/lib/gemini/client";

// ---------------------------------------------------------------------------
// Schemas de validação
// ---------------------------------------------------------------------------

const DIRECTIONS = ["en→pt", "pt→en"] as const;
type Direction = (typeof DIRECTIONS)[number];

const inputSchema = z.object({
  text: z.string().min(1).max(1000),
  direction: z.enum(DIRECTIONS),
});

// ---------------------------------------------------------------------------
// Schema de resposta do Gemini
// ---------------------------------------------------------------------------

const TRANSLATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["translation", "examples"],
  properties: {
    translation: {
      type: Type.STRING,
      description: "The translated text",
    },
    phonetic_pt: {
      type: Type.STRING,
      description:
        "Phonetic pronunciation spelled out intuitively for a native Brazilian Portuguese speaker (e.g., 'tu-guÉ-der' for 'together'). Capitalize the stressed syllable.",
    },
    ipa: {
      type: Type.STRING,
      description:
        "IPA pronunciation of the SOURCE text (only when source is English). Empty string otherwise.",
    },
    examples: {
      type: Type.ARRAY,
      description: "1 to 3 short example sentences showing the source word/phrase in context",
      items: {
        type: Type.OBJECT,
        required: ["source", "translated"],
        properties: {
          source: { type: Type.STRING },
          translated: { type: Type.STRING },
        },
      },
    },
  },
};

interface TranslationResult {
  translation: string;
  phonetic_pt?: string;
  ipa?: string;
  examples: { source: string; translated: string }[];
}

export interface TranslateResponse {
  ok: true;
  translation: string;
  phonetic_pt: string;
  ipa: string;
  examples: { source: string; translated: string }[];
}

export interface TranslateErrorResponse {
  ok: false;
  error: string;
}

// ---------------------------------------------------------------------------
// Action principal
// ---------------------------------------------------------------------------

/**
 * Traduz um texto usando o Gemini e devolve tradução, IPA e exemplos.
 *
 * O modelo `tutor` (flash-lite) é deliberadamente leve: tradução é uma tarefa
 * simples e não precisa do modelo mais forte. Para um aluno que usa o tradutor
 * dezenas de vezes ao dia, manter o custo baixo é importante.
 */
export async function translateAction(
  text: string,
  direction: Direction,
): Promise<TranslateResponse | TranslateErrorResponse> {
  // Autenticação: o tradutor é funcionalidade do app, não pública.
  await requireActiveUser("/app/tradutor");

  const parsed = inputSchema.safeParse({ text, direction });
  if (!parsed.success) {
    return { ok: false, error: "Texto inválido ou muito longo (máximo 1000 caracteres)." };
  }

  const { text: sourceText, direction: dir } = parsed.data;
  const isEnToPt = dir === "en→pt";
  const sourceLang = isEnToPt ? "English" : "Brazilian Portuguese";
  const targetLang = isEnToPt ? "Brazilian Portuguese" : "English";

  const systemInstruction = `
You are a professional translator specializing in ${sourceLang} to ${targetLang} translation
for Brazilian English learners.

Return a JSON object with:
- "translation": the translated text, natural and idiomatic
- "phonetic_pt": intuitive phonetic pronunciation spelled out for a Brazilian Portuguese native speaker (e.g., for "together" return "tu-guÉ-der", for "apple" return "É-pou"). Always mark the stressed syllable with UPPERCASE and accents if needed. If source is Portuguese or text is a long paragraph, return empty string.
- "ipa": IPA transcription of the SOURCE text (only when source is English). Empty string otherwise.
- "examples": 1 to 3 short example sentences using the source word/phrase in context,
  each with "source" (${sourceLang}) and "translated" (${targetLang}).
  Keep examples brief and practical. If the input is a long paragraph, return an empty array.

Be accurate. Prefer natural phrasing over word-for-word translation.
`.trim();

  try {
    const response = await withRetry(() =>
      gemini().models.generateContent({
        model: geminiModels.tutor,
        contents: [
          {
            role: "user",
            parts: [{ text: `Translate from ${sourceLang} to ${targetLang}:\n\n${sourceText}` }],
          },
        ],
        config: {
          systemInstruction,
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: TRANSLATION_SCHEMA,
        },
      }),
    );

    const result = parseJsonResponse<TranslationResult>(response.text);

    if (!result?.translation) {
      return { ok: false, error: "Não foi possível obter a tradução. Tente novamente." };
    }

    return {
      ok: true,
      translation: result.translation,
      phonetic_pt: result.phonetic_pt ?? "",
      ipa: result.ipa ?? "",
      examples: Array.isArray(result.examples) ? result.examples.slice(0, 3) : [],
    };
  } catch (error) {
    console.error("[tradutor] falha na tradução:", error instanceof Error ? error.message : error);
    return {
      ok: false,
      error: "Erro ao traduzir. Verifique sua conexão e tente novamente.",
    };
  }
}

// ---------------------------------------------------------------------------
// Tradução da fala ao vivo
// ---------------------------------------------------------------------------

export interface SpeechTranslateResponse {
  ok: true;
  translation: string;
}

/** Um campo só: é o que segura o modelo no assunto. Ver o comentário abaixo. */
const SPEECH_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["translation"],
  properties: { translation: { type: Type.STRING } },
};

/**
 * Traduz um trecho reconhecido pelo microfone. Só a tradução, nada mais.
 *
 * Existe separada de `translateAction` por causa da LATÊNCIA, não do custo. A
 * action completa pede IPA, fonética e exemplos: são 353 tokens por chamada,
 * medidos, contra 27 desta — e o que o modelo demora para responder é
 * proporcional ao que ele precisa escrever. Numa tela em que a pessoa fala e
 * espera ver a tradução aparecer, cada palavra a mais na resposta é atraso
 * visível.
 *
 * O aluno que quiser IPA e exemplos digita a palavra no tradutor de cima, que
 * continua completo.
 */
export async function translateSpeechAction(
  text: string,
  direction: Direction,
): Promise<SpeechTranslateResponse | TranslateErrorResponse> {
  await requireActiveUser("/app/tradutor");

  const parsed = inputSchema.safeParse({ text, direction });
  if (!parsed.success) {
    return { ok: false, error: "Trecho inválido ou muito longo." };
  }

  const { text: sourceText, direction: dir } = parsed.data;
  const [de, para] =
    dir === "en→pt" ? ["English", "Brazilian Portuguese"] : ["Brazilian Portuguese", "English"];

  const instrucao =
    `Translate from ${de} to ${para}. Natural, spoken register. ` +
    `The input comes from speech recognition, so it has no punctuation ` +
    `or capitalization — your output must have both, written properly.`;

  try {
    /**
     * O parse mora DENTRO do `withRetry`, e não depois dele.
     *
     * `withRetry` retenta explicitamente "resposta vazia" e "interpretar o
     * json" — as duas falhas de formato que os modelos com raciocínio
     * produzem de vez em quando. Com o parse do lado de fora, essa regra nunca
     * era exercida: um `finishReason: MALFORMED_RESPONSE` (que eu vi este
     * modelo devolver) chegava aqui como texto indefinido, estourava na
     * primeira tentativa e virava erro na tela do aluno, sem nenhuma
     * retentativa. Dentro, a mesma falha vira mais uma tentativa.
     */
    /**
     * `thinkingConfig` é uma OTIMIZAÇÃO, e por isso pode cair.
     *
     * Custou caro descobrir: `gemini-3.6-flash` RECUSA `thinkingBudget: 0` com
     * HTTP 400 INVALID_ARGUMENT — reproduzido, 409ms até a recusa —, enquanto
     * `gemini-3.1-flash-lite` aceita. E `DEPLOY.md` mandava cadastrar
     * `GEMINI_MODEL_TUTOR = gemini-3.6-flash` no painel do servidor, então em
     * produção esta chamada morria na primeira tentativa, sempre, enquanto na
     * máquina de desenvolvimento passava 20/20.
     *
     * A configuração agora degrada em vez de quebrar: primeiro a rápida, e se
     * o modelo recusar, a mesma sem o ajuste de raciocínio. Nenhum aluno pode
     * ficar sem tradução porque uma variável de ambiente apontou para outro
     * modelo — e o próximo modelo com outra restrição vai passar por aqui do
     * mesmo jeito.
     */
    const chamar = async (comThinking: boolean) => {
      const response = await gemini().models.generateContent({
        model: geminiModels.tutor,
        contents: [{ role: "user", parts: [{ text: sourceText }] }],
        config: {
          // A instrução vive aqui, e não no `contents`, para o texto do aluno
          // chegar limpo: fala reconhecida já vem sem pontuação confiável, e
          // misturar instrução com transcrição fazia o modelo às vezes traduzir
          // a própria instrução. A ordem de pontuar também não é firula: a fala
          // chega crua ("hi im ana nice to meet you") e o modelo espelhava isso.
          systemInstruction: instrucao,
          /**
           * Saída estruturada, e não texto puro com "responda só a tradução".
           *
           * Medido contra o modelo: em texto puro ele ignorava a instrução e
           * respondia "Aqui estão algumas opções, da mais comum para a mais
           * informal...", e numa frase comum devolvia `MALFORMED_RESPONSE`
           * três vezes em três tentativas. O schema resolve por construção —
           * um campo, uma string — e ainda saiu MAIS rápido (871ms contra
           * 973ms), porque o modelo não escreve preâmbulo.
           */
          responseMimeType: "application/json",
          responseSchema: SPEECH_SCHEMA,
          ...(comThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          temperature: 0,
        },
      });

      const texto = parseJsonResponse<{ translation?: string }>(response.text)?.translation?.trim();
      // Lançar, e não devolver vazio: é o que faz `withRetry` tentar de novo.
      if (!texto) throw new Error("Resposta vazia do Gemini");
      return texto;
    };

    const translation = await withRetry(async () => {
      try {
        return await chamar(true);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        // Só o argumento inválido justifica repetir sem a otimização. Cota,
        // rede e formato têm tratamento próprio e não melhoram com isso.
        if (!/\b400\b|INVALID_ARGUMENT/i.test(m)) throw e;
        console.warn(
          `[tradutor] ${geminiModels.tutor} recusou thinkingBudget; repetindo sem ele.`,
        );
        return await chamar(false);
      }
    });

    return { ok: true, translation };
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : String(error);
    console.error("[tradutor] falha na fala:", detalhe);

    /**
     * A mensagem tem que apontar para a causa certa.
     *
     * "Verifique sua conexão" era o texto para tudo, inclusive quando o
     * problema era o modelo devolvendo formato inválido depois de três
     * tentativas — e aí o aluno vai olhar o wi-fi enquanto o defeito está no
     * servidor. Cada caso agora diz o que fazer, e "tentar de novo" só aparece
     * onde tentar de novo adianta.
     */
    if (/resposta vazia|interpretar o json/i.test(detalhe)) {
      return { ok: false, error: "O tradutor não respondeu direito. Toque em tentar de novo." };
    }
    if (/\b429\b|quota|rate.?limit/i.test(detalhe)) {
      return { ok: false, error: "Limite de traduções atingido por agora. Tente em alguns instantes." };
    }
    if (/\b(401|403)\b|api.?key|permission|unauthenticated/i.test(detalhe)) {
      return { ok: false, error: "A chave da IA foi recusada pelo servidor. Confira GEMINI_API_KEY no ambiente de produção." };
    }
    if (/\b404\b|not found|is not supported|unsupported/i.test(detalhe)) {
      return { ok: false, error: `O modelo de tradução não está disponível neste ambiente (${geminiModels.tutor}).` };
    }
    // Nomear o modelo é o que faltava: o 400 vinha de o modelo configurado no
    // servidor recusar uma opção da chamada, e a tela mandava olhar o wi-fi.
    if (/\b400\b|INVALID_ARGUMENT/i.test(detalhe)) {
      return {
        ok: false,
        error: `O modelo ${geminiModels.tutor} recusou a requisição. Confira GEMINI_MODEL_TUTOR no ambiente.`,
      };
    }

    /**
     * O resto vai com o detalhe técnico anexado, de propósito.
     *
     * A versão anterior devolvia "Erro ao traduzir. Verifique sua conexão"
     * para tudo que não fosse cota ou formato — e foi exatamente esse texto
     * que apareceu em produção, mandando olhar o wi-fi enquanto o defeito real
     * ficava só no log do servidor, onde ninguém consegue ler pelo celular.
     * Uma linha de detalhe transforma "não funciona" em algo diagnosticável na
     * primeira tentativa.
     */
    return {
      ok: false,
      error: `Erro ao traduzir: ${detalhe.slice(0, 180)}`,
    };
  }
}
