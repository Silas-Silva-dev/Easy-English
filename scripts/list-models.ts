/**
 * Lista os modelos do Gemini disponíveis para a sua GEMINI_API_KEY.
 *
 *   npm run models
 *
 * O catálogo do Google muda com o tempo e modelos antigos deixam de ser
 * oferecidos a contas novas. Rode isto quando um modelo retornar 404.
 */

import { env } from "./_shared";

interface ModelInfo {
  name: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

async function main() {
  const key = env("GEMINI_API_KEY");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${key}`,
  );

  const json = (await response.json()) as { models?: ModelInfo[]; error?: { message: string } };

  if (json.error) {
    console.error(`\n✗ ${json.error.message}\n`);
    process.exit(1);
  }

  const models = json.models ?? [];
  const generate = models.filter((m) => m.supportedGenerationMethods?.includes("generateContent"));
  const embed = models.filter((m) => m.supportedGenerationMethods?.includes("embedContent"));
  const live = models.filter((m) => m.supportedGenerationMethods?.includes("bidiGenerateContent"));

  const short = (m: ModelInfo) => m.name.replace("models/", "");

  console.log(`\n\x1b[1mModelos disponíveis para esta chave (${models.length})\x1b[0m\n`);

  console.log(`\x1b[1mgenerateContent (${generate.length})\x1b[0m`);
  for (const m of generate) {
    console.log(`  ${short(m).padEnd(46)} \x1b[2m${m.displayName ?? ""}\x1b[0m`);
  }

  console.log(`\n\x1b[1membedContent (${embed.length})\x1b[0m`);
  for (const m of embed) {
    console.log(`  ${short(m).padEnd(46)} \x1b[2m${m.displayName ?? ""}\x1b[0m`);
  }

  console.log(`\n\x1b[1mbidiGenerateContent — conversa ao vivo (${live.length})\x1b[0m`);
  for (const m of live) {
    console.log(`  ${short(m).padEnd(46)} \x1b[2m${m.displayName ?? ""}\x1b[0m`);
  }

  console.log("");
}

main().catch((error) => {
  console.error("\n✗ Erro:", error instanceof Error ? error.message : error);
  process.exit(1);
});
