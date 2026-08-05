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
 * Mercado Pago — a API de pagamentos do Mercado Livre.
 *
 * O token de PRODUÇÃO (`APP_USR-…`) credita na sua conta real; o de teste
 * (`TEST-…`) roda no sandbox e não move dinheiro. Nunca exponha nenhum dos
 * dois no browser: com ele é possível ler e estornar pagamentos da conta.
 */
export const mercadoPagoEnv = {
  get accessToken() {
    return required("MERCADOPAGO_ACCESS_TOKEN");
  },
  /**
   * Segredo do webhook (Painel → Suas integrações → Webhooks → Assinatura
   * secreta). Sem ele qualquer um que descubra a URL do webhook manda um POST
   * dizendo "pagamento aprovado" e ganha o curso de graça — por isso a
   * validação é obrigatória em produção (ver `assertValidSignature`).
   */
  get webhookSecret() {
    return optional("MERCADOPAGO_WEBHOOK_SECRET", "");
  },
  /** Sandbox: aceita webhook sem assinatura válida e loga o motivo. */
  get isSandbox() {
    return optional("MERCADOPAGO_ACCESS_TOKEN", "").startsWith("TEST-");
  },
  get configured() {
    return Boolean(optional("MERCADOPAGO_ACCESS_TOKEN", ""));
  },
} as const;

/**
 * Preço do acesso ao curso.
 *
 * Em centavos para não arrastar ponto flutuante até a conciliação. O valor
 * default é o preço vigente; mudar exige apenas a variável de ambiente, sem
 * novo deploy de código.
 */
export const checkoutEnv = {
  get priceCents() {
    const raw = Number(optional("CHECKOUT_PRICE_CENTS", "29700"));
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 29700;
  },
  get maxInstallments() {
    const raw = Number(optional("CHECKOUT_MAX_INSTALLMENTS", "10"));
    return Number.isFinite(raw) ? Math.min(24, Math.max(1, Math.round(raw))) : 10;
  },
  get productTitle() {
    return optional("CHECKOUT_PRODUCT_TITLE", "Easy English — Acesso completo ao curso");
  },
  /** Como o nome aparece na fatura do cartão. O Mercado Pago corta em 13 caracteres. */
  get statementDescriptor() {
    return optional("CHECKOUT_STATEMENT_DESCRIPTOR", "EASYENGLISH").slice(0, 13);
  },
  /** Prazo para concluir o pagamento antes de a preferência expirar. */
  get expirationHours() {
    const raw = Number(optional("CHECKOUT_EXPIRATION_HOURS", "48"));
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 48;
  },
} as const;

/**
 * Modelos padrao. O catalogo do Google muda e modelos antigos deixam de ser
 * liberados para contas novas: rode `npm run models` para ver o que a sua
 * chave alcanca e `npm run check` para validar de ponta a ponta.
 */
export const geminiModels = {
  /**
   * Deliberadamente DIFERENTE do modelo de fala: a cota do free tier e contada
   * por projeto E por modelo. Enquanto os dois apontavam para o mesmo
   * `gemini-3.6-flash`, cada mensagem no tutor de texto consumia uma das ~20
   * analises de audio disponiveis no dia. O tutor e tarefa de texto e cabe bem
   * no flash-lite, que tem cota diaria muito maior.
   */
  get tutor() {
    return optional("GEMINI_MODEL_TUTOR", "gemini-3.1-flash-lite");
  },
  /**
   * A fala fica no modelo mais forte: e a unica chamada que precisa OUVIR o
   * audio e diagnosticar fonema (ver BRAZILIAN_INTERFERENCE_GUIDE em
   * `gemini/prompts.ts`). Nao troque por um flash-lite sem comparar o `heard` e
   * o `ipa` de `pronunciation_notes` em audios reais de aluno.
   */
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
