/**
 * Google Cloud Text-to-Speech — vozes Neural2.
 *
 * ===========================================================================
 * POR QUE ISTO NÃO USA A GEMINI_API_KEY
 * ===========================================================================
 * O Cloud TTS RECUSA chave de API. A resposta é explícita:
 *
 *   401 · "API keys are not supported by this API. Expected OAuth2 access
 *          token or other authentication credentials that assert a principal."
 *
 * É outro produto do Gemini TTS (`gemini-*-tts`), que aceita chave do AI
 * Studio. Neural2 e Journey só existem no Cloud TTS, e o Cloud TTS só fala com
 * conta de serviço. Daí este arquivo: assina um JWT com a chave privada da
 * conta de serviço, troca por um access token e usa o token nas chamadas.
 *
 * Sem dependência nova: o `crypto` do Node assina RS256 nativamente, e são
 * ~40 linhas. `google-auth-library` traria 20+ pacotes para fazer isto.
 */

import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SYNTH_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const VOICES_URL = "https://texttospeech.googleapis.com/v1/voices";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

/** O curso inteiro é mono 24 kHz: é o que `pcmToMp3` espera receber. */
export const GOOGLE_SAMPLE_RATE = 24000;

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

export const CREDENTIALS_HELP = `
  Neural2 e Journey exigem uma CONTA DE SERVIÇO do Google Cloud — chave de
  API não funciona nesta API.

  1. console.cloud.google.com → crie (ou escolha) um projeto
  2. Ative a "Cloud Text-to-Speech API" nesse projeto
  3. IAM e Admin → Contas de serviço → Criar conta de serviço
  4. Nela: Chaves → Adicionar chave → Criar nova → JSON → baixe o arquivo
  5. Guarde o arquivo FORA do repositório e aponte no .env.local:

       GOOGLE_TTS_CREDENTIALS=C:/caminho/para/conta-de-servico.json

  O arquivo é uma credencial de verdade: quem o tiver fala pela sua conta.
  Nunca versione, nunca cole em chat.
`;

function loadServiceAccount(): ServiceAccount {
  const path = (
    process.env.GOOGLE_TTS_CREDENTIALS ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    ""
  ).trim();

  if (!path) {
    throw new Error(
      `GOOGLE_TTS_CREDENTIALS não definida.\n${CREDENTIALS_HELP}`,
    );
  }
  if (!existsSync(path)) {
    throw new Error(`Arquivo de credencial não encontrado: ${path}`);
  }

  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as Partial<ServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      `${path} não parece ser a chave JSON de uma conta de serviço ` +
        "(faltam client_email / private_key).",
    );
  }

  return parsed as ServiceAccount;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** O token vale 1h; guardamos até um minuto antes do fim. */
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const account = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const signature = base64url(
    createSign("RSA-SHA256")
      .update(`${header}.${claims}`)
      .sign(account.private_key),
  );

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  const body = (await response.json()) as {
    access_token?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(
      `Não consegui autenticar no Google (HTTP ${response.status}): ` +
        `${body.error_description ?? "resposta sem access_token"}`,
    );
  }

  cachedToken = { value: body.access_token, expiresAt: Date.now() + 3600_000 };
  return cachedToken.value;
}

export interface GoogleVoice {
  name: string;
  ssmlGender: string;
  naturalSampleRateHertz: number;
}

export async function listVoices(
  languageCode = "en-US",
): Promise<GoogleVoice[]> {
  const response = await fetch(`${VOICES_URL}?languageCode=${languageCode}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });

  if (!response.ok) {
    throw new Error(
      `voices.list falhou (HTTP ${response.status}): ${await response.text()}`,
    );
  }

  return ((await response.json()) as { voices?: GoogleVoice[] }).voices ?? [];
}

/**
 * Extrai o PCM cru do WAV que a API devolve.
 *
 * `LINEAR16` vem embrulhado em RIFF. Percorremos os chunks em vez de assumir
 * cabeçalho de 44 bytes: o Google inclui um chunk `LIST` em algumas respostas,
 * e cortar 44 fixos deixaria lixo no começo — que vira estalo no ouvido do
 * aluno.
 */
export function pcmFromWav(wav: Buffer): Buffer {
  if (wav.subarray(0, 4).toString("ascii") !== "RIFF") return wav;

  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.subarray(offset, offset + 4).toString("ascii");
    const size = wav.readUInt32LE(offset + 4);
    if (id === "data")
      return wav.subarray(offset + 8, Math.min(offset + 8 + size, wav.length));
    // Chunks têm tamanho par; ímpar leva um byte de preenchimento.
    offset += 8 + size + (size % 2);
  }

  throw new Error("WAV do Cloud TTS sem chunk 'data'");
}

/**
 * Uma fala, uma voz. Devolve PCM 16 bits mono a 24 kHz.
 *
 * O Cloud TTS não tem modo multi-locutor: cada chamada fala com UMA voz. Quem
 * emenda o diálogo é `generate-audio.ts`, que já fazia exatamente isso para os
 * diálogos de três pessoas do Gemini.
 */
export async function synthesizeLine(
  text: string,
  voiceName: string,
): Promise<Buffer> {
  const response = await fetch(SYNTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "en-US", name: voiceName },
      /**
       * `audioConfig` mínimo de propósito: as vozes Journey rejeitam
       * `speakingRate` e `pitch`, e o aluno já controla a velocidade no player
       * (`playbackRate`), sem reprocessar áudio nenhum.
       */
      audioConfig: {
        audioEncoding: "LINEAR16",
        sampleRateHertz: GOOGLE_SAMPLE_RATE,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `text:synthesize falhou (HTTP ${response.status}): ${await response.text()}`,
    );
  }

  const body = (await response.json()) as { audioContent?: string };
  if (!body.audioContent) throw new Error("a resposta não trouxe audioContent");

  return pcmFromWav(Buffer.from(body.audioContent, "base64"));
}
