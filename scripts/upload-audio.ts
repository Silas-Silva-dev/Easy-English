/**
 * Envia o áudio do curso para o bucket `course-audio` do Supabase.
 *
 * ===========================================================================
 * POR QUE O ÁUDIO SAIU DO REPOSITÓRIO
 * ===========================================================================
 * `public/audio/` guardava 500 arquivos e 56 MB versionados. Funcionou enquanto
 * o curso tinha 364 blocos. A reconstrução do método pede 1.193 blocos base com
 * família de formas: cerca de 13 mil arquivos e 314 MB. Repositório não é
 * servidor de mídia — clonar o projeto passaria a baixar um terço de gigabyte,
 * e cada regeração somaria outra cópia ao histórico, para sempre.
 *
 * ===========================================================================
 * POR QUE UM SCRIPT SEPARADO, E NÃO ENVIO DENTRO DO GERADOR
 * ===========================================================================
 * `generate-audio.ts` continua gravando em `public/audio/`, e isso é de
 * propósito: a retomada dele é o arquivo existir. Não há estado separado para
 * corromper, e um lote interrompido no meio da cota simplesmente continua de
 * onde parou. Enfiar upload lá dentro amarraria a geração à rede e daria duas
 * maneiras de a mesma coisa falhar.
 *
 * Aqui o local é a origem e o bucket é o espelho. Rodar de novo é barato:
 * só sobe o que falta.
 *
 * Uso:
 *   npm run upload:audio                envia o que falta
 *   npm run upload:audio -- --force     reenvia tudo
 *   npm run upload:audio -- --prune     apaga do bucket o que não existe mais local
 *   npm run upload:audio -- --dry       só diz o que faria
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { mapLimit, progress, supabaseAdmin, withRetry } from "./_shared";

const BUCKET = "course-audio";
const DIR = join(process.cwd(), "public", "audio");

const FORCE = process.argv.includes("--force");
const PRUNE = process.argv.includes("--prune");
const DRY = process.argv.includes("--dry");

/** Quantos envios ao mesmo tempo. Acima disso o Storage começa a devolver 429. */
const CONCORRENCIA = 12;

const supabase = supabaseAdmin();

/**
 * Tudo que já está no bucket.
 *
 * `list()` devolve no máximo mil por página, então precisa paginar — sem isso o
 * script reenviaria os mesmos arquivos para sempre, achando que o bucket tem
 * só as primeiras cem entradas.
 */
async function noBucket(): Promise<Map<string, number>> {
  const encontrados = new Map<string, number>();
  const PAGINA = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: PAGINA, offset, sortBy: { column: "name", order: "asc" } });

    if (error) {
      throw new Error(
        `Não consegui listar o bucket ${BUCKET}: ${error.message}\n` +
          `  O bucket existe? Rode a migração 20260101001300_course_audio_bucket.sql.`,
      );
    }
    if (!data?.length) break;

    for (const item of data) {
      // Pastas vêm sem metadata; só interessa arquivo.
      const tamanho = item.metadata?.size;
      if (typeof tamanho === "number") encontrados.set(item.name, tamanho);
    }

    if (data.length < PAGINA) break;
    offset += PAGINA;
  }

  return encontrados;
}

async function main() {
  console.log(`\n\x1b[1m▸ Enviando áudio para o bucket ${BUCKET}\x1b[0m\n`);

  let locais: string[];
  try {
    locais = readdirSync(DIR).filter((f) => f.endsWith(".mp3"));
  } catch {
    console.log(`  Nada em public/audio/. Rode 'npm run gen:audio' primeiro.\n`);
    return;
  }

  if (!locais.length) {
    console.log("  Nenhum mp3 em public/audio/.\n");
    return;
  }

  const remotos = await noBucket();

  const tamanhoLocal = (nome: string) => statSync(join(DIR, nome)).size;

  // Reenvia também o que está no bucket com tamanho diferente: é o sinal de
  // arquivo truncado por envio interrompido, e um mp3 truncado toca pela metade
  // sem dar erro nenhum.
  const aEnviar = FORCE
    ? locais
    : locais.filter((nome) => {
        const remoto = remotos.get(nome);
        return remoto === undefined || remoto !== tamanhoLocal(nome);
      });

  const bytes = aEnviar.reduce((a, n) => a + tamanhoLocal(n), 0);
  console.log(`  local ....... ${locais.length} arquivos`);
  console.log(`  no bucket ... ${remotos.size}`);
  console.log(`  a enviar .... ${aEnviar.length}  (${(bytes / 1024 / 1024).toFixed(1)} MB)\n`);

  if (DRY) {
    for (const nome of aEnviar.slice(0, 20)) console.log(`    ${nome}`);
    if (aEnviar.length > 20) console.log(`    ... e mais ${aEnviar.length - 20}`);
    console.log("\n  (--dry: nada foi enviado)\n");
    return;
  }

  let feitos = 0;
  const falhas: { nome: string; erro: string }[] = [];

  if (aEnviar.length) {
    await mapLimit(aEnviar, CONCORRENCIA, async (nome) => {
      try {
        const corpo = readFileSync(join(DIR, nome));
        await withRetry(async () => {
          const { error } = await supabase.storage.from(BUCKET).upload(nome, corpo, {
            contentType: "audio/mpeg",
            // O nome é o hash do texto: mesmo nome significa mesmo áudio. Então
            // sobrescrever é sempre seguro, e é o que torna --force barato.
            upsert: true,
            cacheControl: "31536000",
          });
          if (error) throw new Error(error.message);
        });
      } catch (error) {
        falhas.push({ nome, erro: error instanceof Error ? error.message : String(error) });
      } finally {
        progress(++feitos, aEnviar.length, nome);
      }
    });
  } else {
    console.log("  Bucket já está em dia.");
  }

  if (PRUNE) {
    const conhecidos = new Set(locais);
    const sobrando = [...remotos.keys()].filter((n) => !conhecidos.has(n));

    if (sobrando.length) {
      console.log(`\n  Apagando ${sobrando.length} órfãos do bucket...`);
      // `remove` aceita lote; mil por vez é o limite prático da API.
      for (let i = 0; i < sobrando.length; i += 1000) {
        const { error } = await supabase.storage.from(BUCKET).remove(sobrando.slice(i, i + 1000));
        if (error) console.error(`    falha ao apagar: ${error.message}`);
      }
      console.log(`  ${sobrando.length} removidos.`);
    } else {
      console.log("\n  Nenhum órfão no bucket.");
    }
  }

  if (falhas.length) {
    console.log(`\n\x1b[31m  ${falhas.length} falharam:\x1b[0m`);
    for (const f of falhas.slice(0, 10)) console.log(`    ${f.nome}: ${f.erro}`);
    if (falhas.length > 10) console.log(`    ... e mais ${falhas.length - 10}`);
    console.log("\n  Rode de novo: o script só reenvia o que falta.\n");
    process.exitCode = 1;
    return;
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  console.log(`\n\x1b[32m  Pronto.\x1b[0m ${locais.length} áudios no bucket.`);
  if (base) console.log(`  Servindo de ${base}/storage/v1/object/public/${BUCKET}/\n`);
}

main().catch((error) => {
  console.error("\n✗ Erro no envio:", error instanceof Error ? error.message : error);
  process.exit(1);
});
