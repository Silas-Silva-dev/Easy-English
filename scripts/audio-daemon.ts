/**
 * Serviço de geração de áudio em segundo plano.
 *
 *   npm run audio:start    # sobe o gerador destacado do terminal
 *   npm run audio:status   # progresso, motor de cada arquivo e fim do log
 *   npm run audio:stop     # encerra
 *
 * ===========================================================================
 * POR QUE UM SERVIÇO E NÃO SÓ `gen:audio -- --watch`
 * ===========================================================================
 * O `--watch` já sabe dormir na cota e retomar sozinho, mas vive preso ao
 * terminal: fechou a janela, acabou o lote. Gerar 500 áudios numa conta
 * gratuita leva dias — não é algo para ficar de babá.
 *
 * Aqui o processo nasce destacado (`detached`), com a saída indo para arquivo.
 * Consequências práticas:
 *
 *   - Pode fechar o terminal. O lote continua.
 *   - O progresso não vive na memória deste processo: são os `.mp3` em disco.
 *     Reiniciar a máquina e subir de novo continua exatamente de onde parou.
 *   - Um único serviço por vez, garantido pelo arquivo de PID.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { config as loadEnv } from "dotenv";

import { audioJobs } from "../content/audio-manifest";

// Este arquivo não passa por `_shared`, que é quem carrega o .env nos demais
// scripts. Sem isto, `GEMINI_TTS_MODEL` chegaria vazio e o serviço subiria com
// o modelo padrão calado, ignorando a escolha feita no .env.local.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const ROOT = process.cwd();
const LOG_DIR = join(ROOT, ".audio-log");
const LOG_PATH = join(LOG_DIR, "generate.log");
const PID_PATH = join(LOG_DIR, "generate.pid");
const AUDIO_DIR = join(ROOT, "public", "audio");
const LEDGER_PATH = join(AUDIO_DIR, "engines.json");

/**
 * Modelo de TTS do curso inteiro.
 *
 * UM só, de propósito. O rodízio entre modelos existia para somar cotas do
 * nível gratuito; com a chave dedicada isso deixou de ser necessário e passou
 * a atrapalhar: modelos diferentes dão timbres diferentes, e a mesma Ana
 * soaria uma pessoa no circuito 1 e outra no circuito 20.
 *
 * Trocar aqui (ou em GEMINI_TTS_MODEL) e reiniciar o serviço regera só o que
 * não saiu deste modelo — o livro-razão guarda qual fez cada arquivo.
 */
const TTS_MODEL = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-2.5-pro-preview-tts";

/**
 * Argumentos do gerador.
 *
 * `--delay 0`: a espera de 6s existia para não estourar o teto por minuto do
 * nível gratuito. Na chave paga ela só faria o lote demorar uma hora a mais.
 */
const GENERATOR_ARGS = [
  "scripts/generate-audio.ts",
  "--engine",
  "gemini",
  "--model",
  TTS_MODEL,
  "--upgrade",
  "--delay",
  "0",
  "--watch",
];

function isRunning(pid: number): boolean {
  try {
    // Sinal 0 não mata: só pergunta se o processo existe e é nosso.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** PID do serviço vivo, ou null. Limpa o arquivo se o processo já morreu. */
function currentPid(): number | null {
  if (!existsSync(PID_PATH)) return null;
  const pid = Number(readFileSync(PID_PATH, "utf8").trim());
  if (!Number.isFinite(pid) || !isRunning(pid)) {
    rmSync(PID_PATH, { force: true });
    return null;
  }
  return pid;
}

function start() {
  const running = currentPid();
  if (running !== null) {
    console.log(`\n  Já existe um serviço rodando (pid ${running}).`);
    console.log(`  Acompanhe com: npm run audio:status\n`);
    return;
  }

  mkdirSync(LOG_DIR, { recursive: true });
  const out = openSync(LOG_PATH, "a");

  // `--import tsx` deixa o Node executar TypeScript direto, sem depender do
  // npx: o processo filho não pode ter um shell no meio, senão o PID que
  // guardamos seria o do shell e o `stop` não mataria o gerador.
  const child = spawn(process.execPath, ["--import", "tsx", ...GENERATOR_ARGS], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", out, out],
    windowsHide: true,
  });

  if (child.pid === undefined) {
    console.error("\n✗ Não consegui iniciar o serviço.\n");
    process.exit(1);
  }

  writeFileSync(PID_PATH, String(child.pid), "utf8");
  child.unref();

  console.log(`\n  \x1b[32m✓\x1b[0m Serviço iniciado (pid ${child.pid}).`);
  console.log(`  Log:    ${LOG_PATH}`);
  console.log(`  Estado: npm run audio:status`);
  console.log(`  Parar:  npm run audio:stop\n`);
  console.log(`  Pode fechar o terminal: o lote segue sozinho e dorme quando a cota fecha.\n`);
}

function stop() {
  const pid = currentPid();
  if (pid === null) {
    console.log("\n  Nenhum serviço rodando.\n");
    return;
  }
  try {
    process.kill(pid);
    rmSync(PID_PATH, { force: true });
    console.log(`\n  \x1b[32m✓\x1b[0m Serviço ${pid} encerrado. O que já foi gerado está em disco.\n`);
  } catch (error) {
    console.error(`\n✗ Falha ao encerrar ${pid}: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

function status() {
  const jobs = audioJobs();
  const ledger: Record<string, unknown> = existsSync(LEDGER_PATH)
    ? JSON.parse(readFileSync(LEDGER_PATH, "utf8"))
    : {};

  const onDisk = jobs.filter((j) => existsSync(join(AUDIO_DIR, `${j.id}.mp3`)));
  const rotulo = (entry: unknown): string => {
    if (!entry) return "desconhecido";
    if (typeof entry === "string") return entry;
    const e = entry as { engine: string; model?: string };
    return e.model ? e.model.replace("gemini-", "").replace("-preview", "") : e.engine;
  };

  const byEngine = onDisk.reduce<Record<string, number>>((acc, j) => {
    const chave = rotulo(ledger[j.id]);
    acc[chave] = (acc[chave] ?? 0) + 1;
    return acc;
  }, {});

  // Pronto = feito pelo modelo escolhido. É essa a meta agora, não "tem áudio".
  const alvo = TTS_MODEL.replace("gemini-", "").replace("-preview", "");
  const gemini = byEngine[alvo] ?? 0;
  const width = 34;
  const filled = Math.round((gemini / jobs.length) * width);

  const pid = currentPid();
  console.log(`\n\x1b[1mGeração de áudio\x1b[0m`);
  console.log(
    `  serviço  ${pid !== null ? `\x1b[32mrodando\x1b[0m (pid ${pid})` : "\x1b[33mparado\x1b[0m"}`,
  );
  console.log(`  catálogo ${jobs.length} áudios · ${onDisk.length} em disco`);
  console.log(
    `  motor    ` +
      Object.entries(byEngine)
        .sort(([, a], [, b]) => b - a)
        .map(([engine, n]) => `${engine} ${n}`)
        .join("  ·  "),
  );
  console.log(
    `\n  ${alvo.padEnd(12)} ${"█".repeat(filled)}${"░".repeat(width - filled)}  ` +
      `${gemini}/${jobs.length} (${Math.round((gemini / jobs.length) * 100)}%)\n`,
  );

  if (existsSync(LOG_PATH)) {
    const lines = readFileSync(LOG_PATH, "utf8").trimEnd().split("\n");
    console.log(`  \x1b[2m--- fim do log (${LOG_PATH}) ---\x1b[0m`);
    for (const line of lines.slice(-12)) console.log(`  ${line}`);
    console.log();
  }
}

const command = process.argv[2] ?? "status";
if (command === "start") start();
else if (command === "stop") stop();
else if (command === "status") status();
else {
  console.error(`\n✗ Comando desconhecido: ${command}. Use start, stop ou status.\n`);
  process.exit(1);
}
