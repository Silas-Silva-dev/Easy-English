/**
 * Diz quem realmente gerou cada áudio, e quantos faltam para o curso ser todo
 * Gemini.
 *
 *   npm run audit:audio              relatório
 *   npm run audit:audio -- --reparar corrige o livro-razão pela evidência
 *
 * ===========================================================================
 * POR QUE O LIVRO-RAZÃO NÃO BASTA
 * ===========================================================================
 * `public/audio/engines.json` registra qual motor fez cada arquivo, e é ele que
 * faz `--upgrade` saber o que regravar. Só que ele mente por omissão: os 104
 * diálogos foram gerados pelo Gemini e não têm entrada nenhuma, porque a
 * gravação do livro-razão perdeu a corrida com o processo do Piper que rodava
 * ao lado. O conserto da corrida veio depois, e a rodada seguinte não
 * reescreveu nada — ela viu 104 de 104 em disco e não teve o que fazer.
 *
 * Resultado prático: quem confiasse no livro-razão regravaria 104 áudios que já
 * estão no formato certo, e pagaria de novo por eles.
 *
 * ===========================================================================
 * O ARQUIVO SABE QUEM O FEZ
 * ===========================================================================
 * A taxa de amostragem denuncia o motor, e ela está dentro do próprio mp3:
 *
 *   Gemini  24.000 Hz   (o modelo devolve PCM 24 kHz mono)
 *   Piper   22.050 Hz   (as vozes en_US-*-medium)
 *
 * Medido: 35 diálogos amostrados, 35 a 24 kHz. 40 blocos amostrados, 40 a
 * 22,05 kHz. Não é heurística frágil, é uma propriedade do formato de saída de
 * cada motor.
 *
 * Este script prefere a evidência ao registro, e com `--reparar` grava a
 * evidência de volta no registro.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { audioJobs, chunkVoice, isCast, spokenLines } from "@content/audio-manifest";

const DIR = join(process.cwd(), "public", "audio");
const LEDGER = join(DIR, "engines.json");
const MODELO_ALVO = "gemini-3.1-flash-tts-preview";

/** Hz que cada motor produz. Ver o cabeçalho. */
const HZ_GEMINI = 24000;

type Entry = string | { engine: string; model?: string; voice?: string };

function lerLedger(): Record<string, Entry> {
  try {
    return JSON.parse(readFileSync(LEDGER, "utf8")) as Record<string, Entry>;
  } catch {
    return {};
  }
}

const registradoVoz = (e: Entry | undefined) =>
  e && typeof e !== "string" ? e.voice : undefined;

function taxa(id: string): number | null {
  const p = join(DIR, `${id}.mp3`);
  if (!existsSync(p)) return null;
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", p],
      { encoding: "utf8" },
    );
    const n = Number(out.trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * A voz que este texto teria HOJE é a mesma de quando ele foi gravado?
 *
 * Duas coisas mudaram desde as primeiras gravações e as duas mudam o timbre:
 * o bloco que diz um nome próprio deixou de sair na narradora, e o elenco
 * ganhou quatro nomes que antes caíam no sorteio por hash. Arquivo com voz
 * errada não é reaproveitável mesmo tendo o texto certo.
 */
function vozAindaVale(
  job: ReturnType<typeof audioJobs>[number],
  gravada: string | undefined,
): boolean {
  // Um locutor fora do elenco cai no sorteio por hash, sempre.
  if (job.kind === "dialogue" && !job.speakers.every((s) => isCast(s))) return false;

  const esperada =
    job.kind === "dialogue"
      ? spokenLines(job, "gemini").map((l) => l.voice).join("+")
      : chunkVoice(job.text, "gemini");

  // Sem voz gravada nao da para afirmar nada: entradas antigas do livro-razao
  // nao guardavam esse campo. Acusar aqui produziria o falso positivo que esta
  // funcao existe para evitar — quatro arquivos corretos apontados como
  // desatualizados so porque a voz deles nao e a da narradora.
  if (!gravada) return true;

  return gravada === esperada;
}

function main() {
  const reparar = process.argv.includes("--reparar");
  const ledger = lerLedger();
  const jobs = audioJobs();

  console.log(`\n\x1b[1m▸ Auditoria do áudio\x1b[0m\n`);
  console.log(`  o curso pede ${jobs.length} áudios. Medindo a taxa de amostragem de cada um...\n`);

  let gemini = 0;
  let piper = 0;
  let ausente = 0;
  let corrigidos = 0;
  let vozVelha = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const hz = taxa(job.id);

    if (hz === null) {
      ausente++;
      continue;
    }

    const motorReal = hz === HZ_GEMINI ? "gemini" : "piper";
    if (motorReal === "gemini") gemini++;
    else piper++;

    const gravada = registradoVoz(ledger[job.id]);
    if (motorReal === "gemini" && !vozAindaVale(job, gravada)) vozVelha++;

    const registrado = ledger[job.id];
    const motorRegistrado = registrado
      ? typeof registrado === "string"
        ? registrado
        : registrado.engine
      : null;

    if (motorRegistrado !== motorReal) {
      corrigidos++;
      // A voz gravada é preservada: ela é a única prova de COM QUAL timbre o
      // arquivo saiu, e reescrever a entrada sem ela apagaria justamente o
      // dado que torna a próxima auditoria exata em vez de suposta.
      ledger[job.id] = {
        engine: motorReal,
        ...(motorReal === "gemini" ? { model: MODELO_ALVO } : {}),
        ...(gravada ? { voice: gravada } : {}),
      };
    }

    if (i % 500 === 0) process.stdout.write(`\r  ${i}/${jobs.length}   `);
  }

  process.stdout.write(`\r${" ".repeat(30)}\r`);

  console.log(`  \x1b[1mPelo arquivo, não pelo registro:\x1b[0m`);
  console.log(`    Gemini 3.1 Flash (24 kHz) .. ${gemini}`);
  console.log(`    Piper (22,05 kHz) .......... ${piper}`);
  if (ausente) console.log(`    sem arquivo ................ ${ausente}`);
  console.log(`\n  o livro-razão errava sobre ... ${corrigidos} arquivo(s)`);
  if (vozVelha) console.log(`  Gemini com voz desatualizada . ${vozVelha}`);

  const faltam = piper + vozVelha;
  console.log(`\n  \x1b[1mA gerar com Gemini: ${faltam}\x1b[0m  (${gemini - vozVelha} já estão prontos)\n`);

  if (!reparar) {
    console.log(`  (--reparar grava a evidência de volta no livro-razão)\n`);
    return;
  }

  const texto = JSON.stringify(
    Object.fromEntries(Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b))),
    null,
    2,
  ) + "\n";
  const temp = `${LEDGER}.${process.pid}.tmp`;
  writeFileSync(temp, texto, "utf8");
  renameSync(temp, LEDGER);
  console.log(`  \x1b[32m✓\x1b[0m livro-razão corrigido em ${corrigidos} entrada(s).\n`);
}

main();
