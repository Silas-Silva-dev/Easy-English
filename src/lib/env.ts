import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith("SEU-") || value === "AIza...") {
    throw new Error(
      `Variavel de ambiente ausente: ${name}. Copie .env.example para .env.local e preencha os valores.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get geminiApiKey() {
    return required("GEMINI_API_KEY");
  },
  get siteUrl() {
    return optional("NEXT_PUBLIC_SITE_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get adminBootstrapEmails() {
    return optional("ADMIN_BOOTSTRAP_EMAILS", "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
} as const;

/**
 * Modelos padrao. O catalogo do Google muda e modelos antigos deixam de ser
 * liberados para contas novas — rode `npm run models` para ver o que a sua
 * chave alcanca e `npm run check` para validar de ponta a ponta.
 */
export const geminiModels = {
  get tutor() {
    return optional("GEMINI_MODEL_TUTOR", "gemini-3.6-flash");
  },
  get speaking() {
    return optional("GEMINI_MODEL_SPEAKING", "gemini-3.6-flash");
  },
  get embedding() {
    return optional("GEMINI_MODEL_EMBEDDING", "gemini-embedding-001");
  },
  /**
   * Não existe modelo de TTS aqui de propósito: o áudio das lições é
   * sintetizado no navegador (`src/lib/speech.ts`), sem API e sem cota.
   * O Gemini fica só com o que exige inteligência: ouvir o aluno, conversar
   * ao vivo, responder dúvidas e indexar o material.
   */
  /** Conversa por voz em tempo real (bidiGenerateContent). */
  get live() {
    return optional("GEMINI_MODEL_LIVE", "gemini-3.1-flash-live-preview");
  },
} as const;

/** Dimensao usada na coluna `knowledge_chunks.embedding vector(768)`. */
export const EMBEDDING_DIMENSIONS = 768;
