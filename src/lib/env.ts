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
  /**
   * Dominio publico dos links de verificacao de certificado — e o endereco que
   * vai dentro do QR Code impresso.
   *
   * Fica separado do `siteUrl` de proposito: um certificado emitido enquanto
   * voce desenvolve tem de apontar para o site de producao, senao o QR leva
   * para `localhost` e nao abre no celular de ninguem. Sem a variavel, cai no
   * `siteUrl` e o comportamento continua o de antes.
   */
  get certificateBaseUrl() {
    return optional("NEXT_PUBLIC_CERTIFICATE_BASE_URL", this.siteUrl).replace(/\/$/, "");
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
 * Ver o comentário de `geminiModels.live`.
 *
 * Preso numa versão, e não em `gemini-2.5-flash-native-audio-latest`, porque o
 * apelido `-latest` gira sozinho: no meio da bancada ele passou a recusar a
 * sessão com "The audio content type (CONTENT_TYPE_AUDIO) is not supported",
 * quatro corridas de doze. Um apelido que muda de comportamento sem deploy é
 * exatamente o que o DEPLOY.md manda evitar.
 */
const MODELO_LIVE_PADRAO = "gemini-2.5-flash-native-audio-preview-12-2025";

/**
 * Modelos que a bancada reprovou para a sala de voz. Não é preferência: é
 * medição registrada em `scripts/_live-bancada.ts`.
 */
const MODELOS_LIVE_REPROVADOS = new Set(["gemini-3.1-flash-live-preview"]);

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
  /** Lista em ordem de preferência para fallback gradativo quando houver erro de cota (429/quota/404). */
  get speakingFallbacks() {
    const primary = optional("GEMINI_MODEL_SPEAKING", "gemini-3.6-flash");
    const candidates = [
      primary,
      "gemini-2.5-flash",
      "gemini-3.5-flash",
      "gemini-2.0-flash",
      "gemini-flash-latest",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-flash-lite-latest",
    ];
    return Array.from(new Set(candidates.filter(Boolean)));
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
  /**
   * Conversa por voz em tempo real (bidiGenerateContent).
   *
   * ==========================================================================
   * POR QUE ESTE MODELO, E POR QUE UM DELES É RECUSADO
   * ==========================================================================
   * `gemini-3.1-flash-live-preview` estava em produção e tornava a sala
   * inutilizável. Medido contra a API, com o mesmo aparato em todas as
   * corridas (`scripts/_live-bancada.ts`, 5 repetições):
   *
   *   ritmo de entrega do áudio    0,12x a 4,28x o tempo real
   *   maior buraco DENTRO de uma
   *     única frase dela           até 24.150 ms
   *   tempo para perceber que o
   *     aluno parou de falar       1,3 s a 65,9 s
   *
   * Vinte e quatro segundos de silêncio no meio de uma frase é o que o aluno
   * ouve como "picotado", e sessenta e cinco segundos para responder é o que
   * ele descreve como "não reconhece quando eu terminei de falar". Nada disso
   * é rede: as medições saíram de um enlace com 2 ms de ping.
   *
   * O native-audio, na mesma bancada:
   *
   *   ritmo                        9,29x a 9,43x (nunca fica para trás)
   *   maior buraco                 41 a 73 ms
   *   fim de fala                  2,5 a 2,8 s, e consistente
   *
   * Por isso o valor recusado abaixo: a variável de ambiente existe para o
   * catálogo do Google mudar sem precisar de deploy, mas uma configuração de
   * produção antiga não pode reimpor um modelo que já se provou quebrado. Se
   * `GEMINI_MODEL_LIVE` apontar para ele, avisamos e usamos o padrão.
   */
  get live() {
    const escolhido = optional("GEMINI_MODEL_LIVE", MODELO_LIVE_PADRAO);
    if (MODELOS_LIVE_REPROVADOS.has(escolhido)) {
      console.warn(
        `[env] GEMINI_MODEL_LIVE="${escolhido}" foi reprovado na bancada da sala de voz ` +
          `(buracos de até 24 s no meio da fala e até 65 s para detectar o fim do turno). ` +
          `Usando "${MODELO_LIVE_PADRAO}". Remova a variável do painel para parar de ver este aviso.`,
      );
      return MODELO_LIVE_PADRAO;
    }
    return escolhido;
  },
} as const;


/** Dimensao usada na coluna `knowledge_chunks.embedding vector(768)`. */
export const EMBEDDING_DIMENSIONS = 768;
