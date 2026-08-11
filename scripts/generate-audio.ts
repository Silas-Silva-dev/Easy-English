/**
 * Gera o áudio das lições e guarda em `public/audio/`, para sempre.
 *
 *   npm run gen:audio              # gera o que ainda falta e para na cota
 *   npm run gen:audio -- --watch   # ao bater a cota, dorme e retoma sozinho
 *   npm run gen:audio -- --limit 20
 *   npm run gen:audio -- --only dialogues
 *   npm run gen:audio -- --dry-run
 *
 * ===========================================================================
 * POR QUE PRÉ-GERAR
 * ===========================================================================
 * O áudio do curso era sintetizado pela voz do sistema operacional. Isso custa
 * zero e funciona offline, mas voz de sistema não produz FALA CONECTADA: não
 * reduz, não elide, não gruda palavra. O nativo diz "whaddaya gonna do";
 * a voz do sistema diz "what are you going to do", separadinho. O aluno
 * treinava 728 dias numa fala sem a propriedade que ia quebrá-lo na vida real.
 *
 * Gerar com TTS neural resolve isso. Gerar UMA VEZ e versionar o resultado
 * preserva tudo que a voz do navegador tinha de bom:
 *
 *   - Custo de execução zero. O aluno baixa um arquivo estático.
 *   - Sem cota no caminho do aluno. A cota é gasta aqui, por você, uma vez.
 *   - Determinístico e revisável, igual ao resto de `content/`: você ouve
 *     antes de o aluno ouvir.
 *
 * ===========================================================================
 * COMO A RETOMADA FUNCIONA
 * ===========================================================================
 * Não existe arquivo de estado, e isso é de propósito. O `.mp3` já gravado É a
 * marca de progresso: o script lista os 468 áudios, pula os que já existem em
 * disco e trabalha no resto. Consequências práticas:
 *
 *   - Pode interromper com Ctrl+C a qualquer momento. Nada corrompe.
 *   - Rode de novo amanhã e ele continua exatamente de onde parou.
 *   - Apagou um arquivo? Ele volta a ser gerado. Só ele.
 *   - Corrigiu uma fala em `content/circuits/`? O texto mudou, o hash mudou,
 *     e o áudio novo é gerado no próximo lote. Ver `src/lib/audio-id.ts`.
 *
 * Enquanto a geração não termina, o app continua funcionando: o player usa o
 * arquivo quando ele existe e cai na voz do navegador quando não existe.
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  audioJobs,
  googleVoiceNames,
  spokenLines,
  voiceFor,
  voicePairFor,
  type AudioJob,
  type Engine,
} from "../content/audio-manifest";

import { GOOGLE_SAMPLE_RATE, listVoices, synthesizeLine } from "./google-tts";
import {
  env,
  genaiTts,
  sleep,
  usingDedicatedTtsKey,
  usingVertexTts,
  vertexTts,
} from "./_shared";

const OUT_DIR = join(process.cwd(), "public", "audio");

/** Voz única para os blocos soltos: o "professor" do curso é sempre o mesmo. */
const CHUNK_VOICE = "Kore";

/**
 * Modelos de TTS em ordem de preferência.
 *
 * São TRÊS de propósito. A cota gratuita é contada por modelo — o próprio erro
 * 429 diz isso no nome: `GenerateRequestsPerDayPerProjectPerModel-FreeTier`.
 * Ou seja: quando um modelo fecha por hoje, os outros dois continuam abertos,
 * e o teto diário do lote passa a ser a SOMA dos três em vez do teto de um.
 *
 * A ordem é por qualidade de fala percebida, não por cota: o rodízio só entra
 * quando o preferido recusa, então o curso sai com a melhor voz disponível a
 * cada momento.
 *
 * Rode `npm run models` se algum dia um deles devolver 404.
 */
const DEFAULT_TTS_MODELS = [
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
];

interface Options {
  limit: number;
  /** Só este circuito: útil para regerar depois de corrigir uma fala. */
  circuit: number | null;
  only: "all" | "dialogues" | "chunks";
  engine: Engine;
  /** Regerar só o que foi feito pelo OUTRO motor. Ver o livro-razão abaixo. */
  upgrade: boolean;
  delayMs: number;
  /** Modelos de TTS a usar em rodízio, na ordem de preferência. */
  models: string[];
  force: boolean;
  dryRun: boolean;
  watch: boolean;
  waitMinutes: number;
  /** Quantos áudios gerar ao mesmo tempo. Ver o padrão em parseArgs. */
  concurrency: number;
}

/**
 * Livro-razão de qual motor fez cada arquivo.
 *
 * É o que torna a estratégia híbrida possível: o Piper preenche os 455 áudios
 * hoje, de graça, e depois `--engine gemini --upgrade` regera SÓ os que o Piper
 * fez, no ritmo que a cota diária permitir. Sem este registro não haveria como
 * distinguir um do outro: o nome do arquivo vem do texto, não do motor.
 */
const LEDGER_PATH = join(OUT_DIR, "engines.json");

/**
 * Uma entrada do livro-razão.
 *
 * Era só o nome do motor. Passou a guardar também o MODELO porque, com a cota
 * resolvida, o problema deixou de ser "de qual motor saiu" e virou "de qual
 * modelo": misturar modelos dá timbres diferentes para o mesmo personagem ao
 * longo do curso. Sem o modelo registrado, deixar tudo uniforme exigiria
 * `--force` — refazer os 500 a cada reinício do serviço.
 *
 * As entradas antigas são strings soltas; `engineOf` aceita as duas formas.
 */
type LedgerEntry = Engine | { engine: Engine; model?: string };

function engineOf(entry: LedgerEntry | undefined): Engine | undefined {
  if (!entry) return undefined;
  return typeof entry === "string" ? entry : entry.engine;
}

function modelOf(entry: LedgerEntry | undefined): string | undefined {
  return entry && typeof entry !== "string" ? entry.model : undefined;
}

function readLedger(): Record<string, LedgerEntry> {
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as Record<string, LedgerEntry>;
  } catch {
    return {};
  }
}

/**
 * Grava o livro-razão relendo o disco antes, e escrevendo de uma vez só.
 *
 * A versão anterior lia o arquivo uma vez no início e depois escrevia o mapa
 * inteiro da memória. Com um processo só isso bastava. Com dois — o Piper
 * enchendo os 7.344 blocos enquanto o Gemini grava os 104 diálogos, que é
 * exatamente o jeito rápido de fazer isto — o segundo a salvar apagava o
 * registro do primeiro. Os .mp3 sobreviveriam, porque o nome vem do texto; o
 * que se perderia é a informação de QUEM gravou cada um, que é justamente o
 * que faz `--upgrade` saber o que regravar.
 *
 * Reler e mesclar faz duas execuções se ajudarem. Escrever ao lado e renomear
 * fecha a janela em que um leitor veria o arquivo pela metade.
 */
function writeLedger(ledger: Record<string, LedgerEntry>) {
  const juntos = { ...readLedger(), ...ledger };
  const sorted = Object.fromEntries(
    Object.entries(juntos).sort(([a], [b]) => a.localeCompare(b)),
  );
  const texto = JSON.stringify(sorted, null, 2) + "\n";
  const temp = `${LEDGER_PATH}.${process.pid}.tmp`;

  // O rename é atômico no POSIX e NÃO é garantido no Windows: se outro
  // processo tem o destino aberto naquele instante, vem EPERM. Como este
  // arquivo existe justamente para dois processos gravarem juntos, a colisão
  // é o caso normal, não o excepcional. Três tentativas resolvem na prática.
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      writeFileSync(temp, texto, "utf8");
      renameSync(temp, LEDGER_PATH);
      return;
    } catch {
      try {
        rmSync(temp, { force: true });
      } catch {
        /* o temp some na próxima tentativa */
      }
    }
  }

  // Desistiu: o livro-razão perde ESTA anotação e o áudio continua gravado.
  //
  // A ordem importa e ela estava errada: uma falha aqui derrubava o job
  // inteiro, e o circuito 17 perdeu a imersão porque a CONTABILIDADE falhou.
  // O .mp3 é o produto; saber qual motor o fez é conveniência para o
  // `--upgrade`. Conveniência não cancela produto.
  console.warn(
    `  \x1b[33m!\x1b[0m não consegui atualizar engines.json agora — o áudio está gravado`,
  );
}

function parseArgs(argv: string[]): Options {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const has = (name: string) => argv.includes(`--${name}`);

  const only = get("only") ?? "all";
  if (!["all", "dialogues", "chunks"].includes(only)) {
    console.error(
      `\n✗ --only aceita: all, dialogues, chunks (recebi "${only}")\n`,
    );
    process.exit(1);
  }

  const engine = get("engine") ?? "gemini";
  if (engine !== "gemini" && engine !== "piper" && engine !== "google") {
    console.error(
      `\n✗ --engine aceita: gemini, piper, google (recebi "${engine}")\n`,
    );
    process.exit(1);
  }

  /**
   * Quantos áudios de cada vez.
   *
   * Validado como --only e --engine, e não com `Math.max(1, Number(x))`:
   * Math.max propaga NaN em vez de aparar, e `Array.from({ length: NaN })`
   * devolve lista VAZIA. Um `--concurrency` sem número (ou com um typo)
   * criava zero trabalhadores, não gerava nada, e ainda assim imprimia o
   * resumo e saía com código 0 — um lote que parecia ter rodado.
   */
  const bruta = get("concurrency") ?? String(usingVertexTts() ? 6 : 1);
  const concurrency = Math.floor(Number(bruta));
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    console.error(
      `
✗ --concurrency precisa ser um inteiro >= 1 (recebi "${bruta}")
`,
    );
    process.exit(1);
  }

  /**
   * Quais modelos usar, em ordem de preferência.
   *
   * Dois nomes de variável por acidente histórico: o serviço lê
   * `GEMINI_TTS_MODEL` (é o que está no .env.local) e este script lia
   * `GEMINI_MODEL_TTS`, que não existe em lugar nenhum. Rodar
   * `npm run gen:audio` sem `--model` ignorava o modelo escolhido e voltava ao
   * rodízio dos três — misturando timbres, que é justamente o que fixar um
   * modelo evita. Aceita os dois, preferindo o documentado.
   *
   * `||` e não `??` de propósito: uma variável definida como "" precisa cair
   * no padrão, e não virar lista vazia — sem modelo nenhum o laço não teria o
   * que tentar e a rodada morreria sem gerar nada.
   */
  const models = (
    get("model") ||
    process.env.GEMINI_TTS_MODEL?.trim() ||
    process.env.GEMINI_MODEL_TTS?.trim() ||
    DEFAULT_TTS_MODELS.join(",")
  )
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  if (!models.length) {
    console.error(`\n✗ --model não deixou nenhum modelo utilizável.\n`);
    process.exit(1);
  }

  return {
    limit: Number(get("limit") ?? Number.POSITIVE_INFINITY),
    circuit: get("circuit") ? Number(get("circuit")) : null,
    only: only as Options["only"],
    engine,
    upgrade: has("upgrade"),
    /**
     * 6s entre chamadas ≈ 10 por minuto. A conta gratuita do Gemini tem teto
     * por minuto e por dia; ir devagar troca tempo de parede por lote que não
     * morre no meio.
     *
     * O Cloud TTS não precisa disso: o limite é de 1000 requisições por minuto
     * e a cobrança é por caractere, não por chamada. Com 6s por fala o curso
     * levaria mais de um dia; sem espera, uns 20 minutos.
     */
    delayMs: Number(
      get("delay") ?? (engine === "google" || usingVertexTts() ? 0 : 6000),
    ),
    /**
     * Uma chamada por vez, exceto no Vertex.
     *
     * Na chave de API o teto é de 10 requisições por minuto: paralelizar só
     * trocaria a espera por uma fila de 429. No Vertex a rajada de teste levou
     * 20 chamadas simultâneas sem nenhuma recusa, e aí o lote inteiro deixa de
     * ser medido em horas.
     *
     * 6 é conservador de propósito: sobra folga para o `retry` de sobrecarga e
     * o gargalo passa a ser o ffmpeg, não a rede.
     */
    concurrency,
    models,
    force: has("force"),
    dryRun: has("dry-run"),
    watch: has("watch"),
    waitMinutes: Number(get("wait") ?? 60),
  };
}

// ===========================================================================
// Conversão do áudio
//
// A API devolve PCM cru de 24 kHz, 16 bits, mono: 48 KB por segundo. Os ~53
// minutos do curso inteiro dariam uns 150 MB em WAV, que é repositório demais.
// Em MP3 mono de 64 kbps a mesma coisa cabe em ~25 MB, sem perda audível para
// voz falada.
// ===========================================================================

function haveFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    probe.on("error", () => resolve(false));
    probe.on("close", (code) => resolve(code === 0));
  });
}

function pcmToMp3(
  pcm: Buffer,
  sampleRate: number,
  outPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "s16le",
      "-ar",
      String(sampleRate),
      "-ac",
      "1",
      "-i",
      "pipe:0",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "64k",
      "-y",
      outPath,
    ]);

    let stderr = "";
    ff.stderr.on("data", (d) => (stderr += d.toString()));
    ff.on("error", reject);
    ff.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg saiu com ${code}: ${stderr.trim()}`)),
    );

    ff.stdin.on("error", () => {
      /* ffmpeg pode fechar a entrada antes de nós; o 'close' acima decide. */
    });
    ff.stdin.end(pcm);
  });
}

// ===========================================================================
// Chamada ao Gemini
// ===========================================================================

/** Instrução de estilo: é o que separa "leitura" de "conversa". */
const DIALOGUE_STYLE =
  "Read the following conversation the way two Americans would actually say it: " +
  "natural conversational pace, contractions, linked words, real intonation. " +
  "Do not enunciate word by word.";

const CHUNK_STYLE =
  "Say the following phrase the way an American says it in normal conversation: " +
  "natural speed, natural linking. Say it once.";

/** Uma chamada ao TTS. Devolve PCM cru e a taxa de amostragem. */
/**
 * Cliente do TTS, montado uma vez só.
 *
 * Um por processo, não um por chamada: no modo Vertex o cliente guarda o token
 * OAuth, e recriá-lo a cada áudio refaria a troca de credencial 500 vezes.
 *
 * O Vertex ganha quando está configurado porque só ele escapa do teto diário
 * da Gemini API — mesmos modelos, mesmas vozes, contabilidade por minuto.
 */
let ttsClientCache: ReturnType<typeof genaiTts> | null = null;
function ttsClient() {
  if (!ttsClientCache) ttsClientCache = vertexTts() ?? genaiTts();
  return ttsClientCache;
}

async function speak(
  text: string,
  speechConfig: object,
  model: string,
): Promise<{ pcm: Buffer; rate: number }> {
  const response = await ttsClient().models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text }] }],
    config: { responseModalities: ["AUDIO"], speechConfig },
  });

  const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) throw new Error("a resposta não trouxe áudio");

  return {
    pcm: Buffer.from(inline.data, "base64"),
    rate: Number(/rate=(\d+)/.exec(inline.mimeType ?? "")?.[1] ?? 24000),
  };
}

const oneVoice = (name: string) => ({
  voiceConfig: { prebuiltVoiceConfig: { voiceName: name } },
});

/** 400 ms de silêncio entre falas emendadas: sem isso a conversa atropela. */
function silence(rate: number, ms = 400): Buffer {
  return Buffer.alloc(Math.round((rate * 2 * ms) / 1000));
}

/**
 * Gera o áudio de um item do catálogo.
 *
 * O caminho depende de quantas pessoas falam, porque o modo multi-locutor da
 * API aceita EXATAMENTE dois: nem um, nem três:
 *
 *   2 locutores  → uma chamada só, com as duas vozes. É o caso de 96 dos 104
 *                  diálogos, e é o que torna a pré-geração barata.
 *   1 locutor    → voz única. Os circuitos 49 são monólogos.
 *   3 locutores  → uma chamada por fala, cada uma na voz do seu personagem, e
 *                  o PCM emendado no fim. Custa mais cota, mas são só 6
 *                  diálogos no curso inteiro: e a alternativa seria jogar
 *                  fora a distinção de vozes justamente nas cenas com mais
 *                  gente, que são as mais difíceis de acompanhar.
 */
async function synthesize(
  job: AudioJob,
  model: string,
  delayMs: number,
): Promise<{ pcm: Buffer; rate: number }> {
  if (job.kind !== "dialogue") {
    return speak(`${CHUNK_STYLE}\n\n${job.text}`, oneVoice(CHUNK_VOICE), model);
  }

  // O roteiro é guardado como "A: fala / B: fala"; o TTS quer uma fala por linha.
  const lines = job.text.split(/\s*\/\s*/);

  if (job.speakers.length === 2) {
    const [voiceA, voiceB] = voicePairFor(job.speakers[0], job.speakers[1]);
    return speak(
      `${DIALOGUE_STYLE}\n\n${lines.join("\n")}`,
      {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: job.speakers[0],
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceA } },
            },
            {
              speaker: job.speakers[1],
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceB } },
            },
          ],
        },
      },
      model,
    );
  }

  if (job.speakers.length === 1) {
    return speak(
      `${DIALOGUE_STYLE}\n\n${lines.join("\n")}`,
      oneVoice(voiceFor(job.speakers[0])),
      model,
    );
  }

  // Três ou mais: fala a fala, emendando o PCM.
  const parts: Buffer[] = [];
  let rate = 24000;

  for (let i = 0; i < lines.length; i++) {
    const match = /^([^:]{1,24}):\s*(.+)$/.exec(lines[i]);
    const who = match?.[1]?.trim() ?? job.speakers[0];
    const said = match?.[2]?.trim() ?? lines[i];

    const piece = await speak(
      `${CHUNK_STYLE}\n\n${said}`,
      oneVoice(voiceFor(who)),
      model,
    );
    rate = piece.rate;
    if (parts.length) parts.push(silence(rate));
    parts.push(piece.pcm);

    if (i < lines.length - 1) await sleep(delayMs);
  }

  return { pcm: Buffer.concat(parts), rate };
}

// ===========================================================================
// Motor Google Cloud TTS (Neural2)
//
// Diferença estrutural para o Gemini: o Cloud TTS NÃO tem modo multi-locutor.
// Cada chamada fala com uma voz só. Então todo diálogo vira uma chamada por
// fala, com o PCM emendado — o mesmo caminho que o Gemini já usava para os seis
// diálogos de três pessoas, agora valendo para os 132.
//
// Isso custa mais chamadas, e é irrelevante aqui: o Cloud TTS cobra por
// CARACTERE, não por requisição. O curso inteiro cabe na cota gratuita mensal
// de 1 milhão de caracteres do Neural2.
// ===========================================================================

async function synthesizeGoogle(
  job: AudioJob,
  delayMs: number,
): Promise<{ pcm: Buffer; rate: number }> {
  const lines = spokenLines(job, "google");
  const parts: Buffer[] = [];

  for (let i = 0; i < lines.length; i++) {
    parts.push(await synthesizeLine(lines[i].text, lines[i].voice));
    if (i < lines.length - 1) {
      // 400 ms entre falas: sem isso a conversa atropela.
      parts.push(silence(GOOGLE_SAMPLE_RATE));
      if (delayMs) await sleep(delayMs);
    }
  }

  return { pcm: Buffer.concat(parts), rate: GOOGLE_SAMPLE_RATE };
}

/**
 * Confere que TODAS as vozes do elenco existem na API antes de gerar.
 *
 * O Google aposenta família de voz (foi o que aconteceu com as Journey). Sem
 * esta checagem, uma voz retirada só apareceria como erro no meio do lote —
 * depois de já ter gravado dezenas de arquivos com o elenco pela metade.
 */
async function assertGoogleVoices(): Promise<void> {
  const available = new Set((await listVoices("en-US")).map((v) => v.name));
  const missing = googleVoiceNames().filter((name) => !available.has(name));

  if (missing.length) {
    const neural2 = [...available].filter((n) => n.includes("Neural2")).sort();
    console.error(
      `\n✗ Vozes do elenco indisponíveis na sua conta: ${missing.join(", ")}\n` +
        `  Neural2 que a API oferece agora: ${neural2.join(", ") || "nenhuma"}\n` +
        "  Ajuste GOOGLE_VOICES em content/audio-manifest.ts.\n",
    );
    process.exit(1);
  }

  console.log(`  vozes   ${googleVoiceNames().join(", ")}`);
}

/** Distingue "acabou a cota" de "deu erro nesse item". */
/**
 * Sobrecarga passageira do modelo (503/UNAVAILABLE, 500) — nada a ver com cota.
 *
 * Os modelos de TTS em preview devolvem isso com frequência. Antes esse erro
 * caía no ramo "erro do item": o job saía da fila e era contado como falha,
 * quando bastava esperar alguns segundos. Num lote de 500 isso descartava
 * dezenas de áudios por rodada sem motivo.
 */
function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(500|502|503|504)|UNAVAILABLE|overloaded|internal error|deadline/i.test(message);
}

/**
 * Quanto a API mandou esperar, em ms. O corpo do 429 traz `retryDelay`, e ele
 * é bem mais preciso que qualquer escada que a gente invente.
 */
function retryDelayMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(message);
  return match ? Math.ceil(Number(match[1]) * 1000) : null;
}

/**
 * Teto de minuto ou de dia?
 *
 * Não dá para saber pelo nome da cota: o corpo do 429 lista as violações de
 * minuto E de dia juntas, sempre. Quem responde de verdade é o `retryDelay` —
 * o teto por minuto volta em dezenas de segundos, o diário não. Rotular pelo
 * ID daria "cota diária, volta em 59s", que é contraditório e engana quem lê
 * o log para decidir se vale esperar.
 */
function quotaKindLabel(waitMs: number): string {
  return waitMs <= 5 * 60_000 ? "por minuto" : "diária";
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(message);
}

// ===========================================================================
// Motor local (Piper)
//
// Um único processo Python dá conta do lote inteiro: carregar um modelo custa
// ~4s e sintetizar uma fala custa ~0,23s, então abrir o processo por fala
// gastaria quase todo o tempo carregando modelo. Ver scripts/piper_worker.py.
// ===========================================================================

const VOICES_DIR = join(process.cwd(), ".piper-voices");

/**
 * Os ids que existem em disco AGORA.
 *
 * Relido no fim de cada lote em vez de somar `já existiam + gerados`. Com
 * `--force` as duas parcelas se sobrepõem: os 461 arquivos que já estavam lá
 * eram os mesmos 462 que acabaram de ser reescritos: e a soma anunciava
 * "923/462 áudios, faltam -461". O disco é a única fonte que não erra isso.
 */
function countOnDisk(): Set<string> {
  return new Set(
    readdirSync(OUT_DIR)
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => f.replace(/\.mp3$/, "")),
  );
}

async function runPiper(
  pending: AudioJob[],
  ledger: Record<string, LedgerEntry>,
  wanted: AudioJob[],
): Promise<void> {
  if (!existsSync(VOICES_DIR)) {
    console.error(
      `\n✗ Vozes do Piper não encontradas em ${VOICES_DIR}\n` +
        `  Instale uma vez com:  npm run gen:audio:setup\n`,
    );
    process.exit(1);
  }

  // O TypeScript decide quem fala com qual voz; o Python só sintetiza.
  const payload = pending.map((job) => ({
    id: job.id,
    lines: spokenLines(job, "piper"),
  }));

  const jobsPath = join(tmpdir(), `easyenglish-piper-${process.pid}.json`);
  writeFileSync(jobsPath, JSON.stringify(payload), "utf8");

  const labels = new Map(pending.map((j) => [j.id, j.label]));
  let generated = 0;
  let failed = 0;

  await new Promise<void>((resolve, reject) => {
    const python = spawn("python", [
      join("scripts", "piper_worker.py"),
      jobsPath,
      OUT_DIR,
      VOICES_DIR,
    ]);

    let buffer = "";
    python.stdout.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const [tag, id, rest] = line.trim().split(/\s+/, 3);

        if (tag === "READY") {
          console.log(`  ${id} vozes carregadas, sintetizando…\n`);
        } else if (tag === "OK") {
          generated++;
          ledger[id] = "piper";
          // Grava a cada arquivo: uma queda no meio não perde o registro do
          // que já foi feito, e o --upgrade continua sabendo a origem de cada um.
          writeLedger(ledger);
          console.log(
            `  \x1b[32m✓\x1b[0m ${String(generated).padStart(3)}/${pending.length}  ${String(rest ?? "?").padStart(5)}s  ${labels.get(id) ?? id}`,
          );
        } else if (tag === "FAIL") {
          failed++;
          console.log(
            `  \x1b[31m✗\x1b[0m ${labels.get(id) ?? id}\n      ${rest ?? ""}`,
          );
        }
      }
    });

    python.stderr.on("data", (data) => {
      const text = data.toString().trim();
      if (text.startsWith("FATAL")) console.error(`  \x1b[31m${text}\x1b[0m`);
    });

    python.on("error", reject);
    python.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`piper_worker.py saiu com ${code}`)),
    );
  });

  rmSync(jobsPath, { force: true });

  const ready = countOnDisk();
  const now = wanted.filter((j) => ready.has(j.id)).length;
  const total = wanted.length;
  console.log(`\n  ${now}/${total} áudios em public/audio/`);
  if (failed)
    console.log(
      `  \x1b[31m${failed}\x1b[0m falharam: rode de novo para tentar só eles.`,
    );
  console.log(
    now === total
      ? `\n  \x1b[32mCompleto.\x1b[0m Commit public/audio/.\n` +
          `  Para trocar por áudio do Gemini aos poucos, conforme a cota:\n` +
          `    npm run gen:audio -- --engine gemini --upgrade --only dialogues\n`
      : `  Faltam ${total - now}.\n`,
  );
}

// ===========================================================================
// Execução
// ===========================================================================

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!(await haveFfmpeg())) {
    console.error(
      "\n✗ ffmpeg não encontrado no PATH.\n" +
        "  Ele converte o PCM cru da API em MP3: sem isso o repositório levaria ~150 MB.\n" +
        "  Windows: winget install Gyan.FFmpeg\n",
    );
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const all = audioJobs();
  const scoped = options.circuit
    ? all.filter((j) => j.circuit === options.circuit)
    : all;
  const wanted = scoped.filter((j) =>
    options.only === "all"
      ? true
      : options.only === "dialogues"
        ? j.kind === "dialogue"
        : j.kind === "chunk",
  );

  const onDisk = countOnDisk();

  const ledger = readLedger();

  /**
   * O que falta fazer.
   *
   *   normal: o que ainda não existe em disco (retomada por existência)
   *   --upgrade: o que existe mas foi feito pelo outro motor
   *   --force: tudo, de novo
   */
  const missing = (job: AudioJob) => {
    if (options.force) return true;
    if (!onDisk.has(job.id)) return true;
    if (!options.upgrade) return false;
    if (engineOf(ledger[job.id]) !== options.engine) return true;
    // Mesmo motor, modelo diferente: refaz, senão o curso fica com timbres
    // misturados. Só vale quando um único modelo foi pedido.
    return options.engine === "gemini" && options.models.length === 1
      ? modelOf(ledger[job.id]) !== options.models[0]
      : false;
  };

  const pending = wanted
    .filter(missing)
    .slice(0, Number.isFinite(options.limit) ? options.limit : undefined);

  const done = wanted.filter((j) => onDisk.has(j.id)).length;
  const byThisEngine = wanted.filter(
    (j) => engineOf(ledger[j.id]) === options.engine,
  ).length;

  // Por onde as chamadas saem. Vale dizer em voz alta porque decide o teto do
  // lote: pelo Vertex são centenas por minuto, pela chave de API são 100 por
  // DIA — e a diferença entre "pronto hoje" e "pronto na semana que vem" não
  // pode depender de adivinhar qual dos dois está ativo.
  const transportLabel = usingVertexTts()
    ? " · Vertex AI"
    : usingDedicatedTtsKey()
      ? " · chave dedicada"
      : "";

  const engineLabel =
    options.engine === "gemini"
      ? ` (${options.models.join(" → ")})${transportLabel}`
      : options.engine === "google"
        ? " (Cloud TTS · Neural2)"
        : " (local, sem cota)";

  console.log(`\n\x1b[1mÁudio das lições\x1b[0m`);
  console.log(`  motor    ${options.engine}${engineLabel}`);
  if (options.concurrency > 1)
    console.log(`  paralelo ${options.concurrency} áudios ao mesmo tempo`);
  console.log(
    `  catálogo ${all.length} áudios (${all.filter((j) => j.kind === "dialogue").length} diálogos + ${all.filter((j) => j.kind === "chunk").length} blocos)`,
  );
  console.log(
    `  em disco ${done}/${wanted.length}  ·  ${byThisEngine} deste motor`,
  );
  console.log(
    `  nesta rodada ${pending.length}${options.upgrade ? " (--upgrade)" : ""}\n`,
  );

  if (!pending.length) {
    console.log("  Nada a fazer: o áudio está completo.\n");
    return;
  }

  if (options.dryRun) {
    for (const job of pending) console.log(`  · ${job.id}  ${job.label}`);
    // Caracteres é como o Cloud TTS cobra: o número que decide se cabe na cota.
    if (options.engine === "google") {
      const chars = pending.reduce((sum, job) => sum + job.text.length, 0);
      console.log(
        `\n  ${chars.toLocaleString("pt-BR")} caracteres nesta rodada`,
      );
      console.log(
        `  \x1b[2mNeural2: 1.000.000 grátis por mês, depois US$ 16 por milhão\x1b[0m`,
      );
    }
    console.log(`\n  (--dry-run: nada foi gerado)\n`);
    return;
  }

  if (options.engine === "google") await assertGoogleVoices();

  // ------------------------------------------------------------ motor local
  if (options.engine === "piper") {
    await runPiper(pending, ledger, wanted);
    return;
  }

  let generated = 0;
  let failed = 0;
  const queue = [...pending];

  /**
   * Rodízio de modelos.
   *
   * A cota gratuita é por modelo (o 429 diz: `...PerProjectPerModel-FreeTier`).
   * Então "bateu a cota" não significa "acabou por hoje": significa que ESTE
   * modelo fechou. Marcamos só ele como indisponível até o horário que a
   * própria API mandou esperar e seguimos no próximo, com o MESMO job.
   *
   * A rodada só dorme de verdade quando os três estão bloqueados ao mesmo
   * tempo — e aí dorme até o primeiro deles liberar, não um tempo fixo.
   */
  const blockedUntil = new Map<string, number>(options.models.map((m) => [m, 0]));
  const nextFree = () => Math.min(...options.models.map((m) => blockedUntil.get(m) ?? 0));
  const availableModel = () => {
    const now = Date.now();
    return options.models.find((m) => (blockedUntil.get(m) ?? 0) <= now) ?? null;
  };

  /** Espera padrão quando a API não diz por quanto tempo. */
  const MINUTE_BLOCK_MS = 60_000;
  /** Teto diário: o modelo só volta quando a janela vira. */
  const DAY_BLOCK_MS = 60 * 60_000;
  /**
   * Teto para quanto tempo confiamos no `retryDelay`.
   *
   * Ele é uma estimativa pessimista, não um contrato: medindo contra a API, um
   * `retryDelay` de 71 minutos liberou em bem menos. Dormir o valor cheio
   * deixava o lote parado por mais de uma hora sem necessidade.
   *
   * Reconsultar é de graça — requisição recusada não consome cota —, então o
   * bloqueio é limitado a alguns minutos e a espera vira uma sequência de
   * tentativas curtas em vez de uma soneca longa no escuro.
   */
  const MAX_BLOCK_MS = 5 * 60_000;

  // Sobrecarga transitória: recuo exponencial no MESMO job, sem descartar.
  const TRANSIENT_BASE_MS = 4_000;
  const TRANSIENT_MAX_TRIES = 6;

  /**
   * Encerramento antecipado: a cota fechou e ninguém pediu --watch.
   *
   * Compartilhado porque agora há vários trabalhadores na mesma fila: o
   * primeiro que esbarra na cota levanta a bandeira e os outros param na volta
   * seguinte, em vez de cada um imprimir o mesmo aviso.
   */
  let aborted = false;

  /** A parada foi por cota (e não por fim da fila). Decide o aviso final. */
  let quotaStopped = false;

  /** Evita o mesmo "dormindo N min" repetido uma vez por trabalhador. */
  let sleepAnnouncedFor = 0;

  /**
   * Gera UM áudio, com as tentativas dele.
   *
   * As tentativas moram aqui dentro, e não na fila, porque são do item: cota,
   * sobrecarga e erro de conteúdo pedem respostas diferentes e todas elas
   * precisam do mesmo job em mãos. `transientTries` é local de propósito —
   * era uma variável só para o lote inteiro, o que já estava errado em série
   * (um item sobrecarregado gastava as tentativas do próximo) e ficaria pior
   * com vários itens ao mesmo tempo.
   */
  async function processJob(job: AudioJob): Promise<void> {
    const outPath = join(OUT_DIR, `${job.id}.mp3`);
    let transientTries = 0;

    while (!aborted) {
      // Todos bloqueados: dorme até o primeiro liberar (ou encerra sem --watch).
      if (options.engine === "gemini" && !availableModel()) {
        const wakeAt = nextFree();
        const waitMs = Math.max(1000, wakeAt - Date.now());

        if (!options.watch) {
          // Só levanta a bandeira — o aviso sai depois que todos pararem,
          // com os números já estáveis. Ver o bloco após o Promise.all.
          aborted = true;
          quotaStopped = true;
          return;
        }

        if (wakeAt !== sleepAnnouncedFor) {
          sleepAnnouncedFor = wakeAt;
          console.log(
            `  [33m·[0m todos os modelos na cota — dormindo ${Math.ceil(waitMs / 60_000)} min e retomando sozinho`,
          );
        }
        await sleep(waitMs);
        continue; // mesmo job
      }

      const model = options.engine === "gemini" ? availableModel()! : "";

      try {
        const { pcm, rate } =
          options.engine === "google"
            ? await synthesizeGoogle(job, options.delayMs)
            : await synthesize(job, model, options.delayMs);
        await pcmToMp3(pcm, rate, outPath);

        generated++;

        /**
         * Registra o motor deste arquivo.
         *
         * Só o caminho do Piper fazia isso: os áudios gerados pelo Gemini saíam
         * do lote sem entrar no livro-razão. Efeito prático: `--upgrade` os
         * tratava como "de outro motor" e regerava tudo de novo, e não havia como
         * responder "este arquivo saiu de qual motor?" — que é exatamente a
         * pergunta que se faz depois de trocar de TTS.
         *
         * O transporte (chave de API ou Vertex) NÃO entra aqui de propósito: o
         * modelo é o mesmo dos dois lados, então o áudio é o mesmo. Registrar a
         * diferença faria `--upgrade` refazer o que já está pronto e correto.
         *
         * Gravado a cada arquivo, como no Piper: uma queda no meio do lote não
         * perde o registro do que já foi feito.
         */
        ledger[job.id] = model ? { engine: options.engine, model } : options.engine;
        writeLedger(ledger);

        const secs = (pcm.length / (rate * 2)).toFixed(1);
        const tag = model ? `  [2m${model.replace(/^gemini-|-preview$|-tts-preview$/g, "")}[0m` : "";
        console.log(
          `  [32m✓[0m ${String(generated).padStart(3)}/${pending.length}  ${secs.padStart(5)}s  ${job.label}${tag}`,
        );
        return;
      } catch (error) {
        if (isQuotaError(error)) {
          // Fecha SÓ este modelo. O laço já escolhe outro na próxima volta.
          // Sem `retryDelay` no corpo, assume o pior: o modelo fechou por hoje.
          const sugerido = retryDelayMs(error) ?? DAY_BLOCK_MS;
          const wait = Math.min(sugerido, MAX_BLOCK_MS);
          blockedUntil.set(model, Date.now() + wait);

          const outros = options.models.filter((m) => (blockedUntil.get(m) ?? 0) <= Date.now());
          console.log(
            `  [33m·[0m ${model}: cota ${quotaKindLabel(sugerido)} ` +
              `(a API pediu ${Math.ceil(sugerido / 1000)}s; reconsultando em ${Math.ceil(wait / 1000)}s)` +
              (outros.length ? ` — seguindo em ${outros[0]}` : ""),
          );
          continue; // mesmo job, outro modelo
        }

        if (isTransientError(error)) {
          transientTries++;
          if (transientTries <= TRANSIENT_MAX_TRIES) {
            const wait = TRANSIENT_BASE_MS * 2 ** (transientTries - 1);
            console.log(
              `  [33m·[0m ${model || options.engine} sobrecarregado: ` +
                `nova tentativa em ${Math.round(wait / 1000)}s (${transientTries}/${TRANSIENT_MAX_TRIES})`,
            );
            await sleep(wait);
            continue; // mesmo job
          }
          // Insistiu demais: bloqueia o modelo por um tempo e tenta em outro.
          blockedUntil.set(model, Date.now() + MINUTE_BLOCK_MS);
          transientTries = 0;
          continue;
        }

        // Erro do item, não da cota nem da API: registra, segue para o próximo.
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        console.log(`  [31m✗[0m ${job.label}
      ${message.slice(0, 160)}`);
        return;
      }
    }
  }

  /**
   * Um trabalhador puxa da fila até ela secar.
   *
   * `shift()` é seguro sem trava: o Node só troca de tarefa nos `await`, e
   * entre pegar o job e a fila encolher não há nenhum.
   */
  async function worker(): Promise<void> {
    while (!aborted) {
      const job = queue.shift();
      if (!job) return;
      await processJob(job);
      if (queue.length && options.delayMs) await sleep(options.delayMs);
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));

  /**
   * Parou por cota e ninguém pediu --watch: este aviso É o fim da rodada.
   *
   * Ele morava dentro do laço, onde o `return` saía de main() inteiro. Com a
   * fila paralela o `return` passou a sair só do job, e o resumo comum caía
   * logo abaixo — a rodada terminava dizendo "rode de novo quando a cota
   * renovar" e, na linha seguinte, "rode de novo quando quiser".
   *
   * Imprimir aqui também conserta os números: lá dentro, `generated` era lido
   * com até concurrency-1 áudios ainda em voo, e os `✓` deles saíam DEPOIS do
   * aviso de parada.
   */
  if (quotaStopped) {
    const left = wanted.length - done - generated;
    console.log(
      `
  [33m▲ Os ${options.models.length} modelos de TTS estão na cota.[0m ` +
        `${generated} gerados nesta rodada.

` +
        `  Faltam ${left} áudios. Rode de novo quando a cota renovar:
` +
        `  o script continua exatamente daqui, os ${done + generated} prontos não são refeitos.
` +
        `  Para ele mesmo esperar e retomar sozinho: npm run gen:audio -- --watch
`,
    );
    return;
  }

  // Do disco, não `done + generated`: ver countOnDisk.
  const ready = countOnDisk();
  const total = wanted.filter((j) => ready.has(j.id)).length;
  console.log(`\n  ${total}/${wanted.length} áudios prontos em public/audio/`);
  if (failed)
    console.log(
      `  \x1b[31m${failed}\x1b[0m falharam: rode de novo para tentar só eles.`,
    );
  if (total === wanted.length) {
    console.log(
      `\n  \x1b[32mCompleto.\x1b[0m Não esqueça de commitar public/audio/.\n`,
    );
  } else {
    console.log(
      `  Faltam ${wanted.length - total}. Rode de novo quando quiser.\n`,
    );
  }
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
