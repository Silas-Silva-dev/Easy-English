/**
 * Remove os resquícios do áudio gerado por API.
 *
 *   npm run cleanup:audio           # só lista o que existe
 *   npm run cleanup:audio -- --yes  # apaga de verdade
 *
 * Contexto: até a migration 20260101000500 o curso pré-gerava WAVs com o TTS do
 * Gemini e os guardava no bucket `lesson-audio`. Agora a fala é sintetizada no
 * navegador e esses arquivos não são lidos por ninguém.
 *
 * Por que um script e não SQL: o Supabase instala um trigger que RECUSA
 * `delete from storage.objects`: arquivo só sai pela Storage API. E enquanto
 * houver arquivo, o bucket não pode ser removido.
 *
 * É destrutivo e irreversível, por isso exige `--yes`.
 */

import { supabaseAdmin } from "./_shared";

const BUCKET = "lesson-audio";
const CONFIRMED = process.argv.includes("--yes");

async function main() {
  const supabase = supabaseAdmin();

  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) throw new Error(`Não consegui listar os buckets: ${bucketsError.message}`);

  const exists = buckets.some((b) => b.id === BUCKET);
  if (!exists) {
    console.log(`\n✓ Nada a fazer: o bucket "${BUCKET}" não existe.\n`);
    return;
  }

  // Lista recursiva: os áudios ficavam em <kind>/<hash>.wav
  const paths: string[] = [];
  const { data: folders } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });

  for (const entry of folders ?? []) {
    if (entry.id) {
      // Arquivo na raiz do bucket.
      paths.push(entry.name);
      continue;
    }
    const { data: inner } = await supabase.storage
      .from(BUCKET)
      .list(entry.name, { limit: 1000 });
    for (const file of inner ?? []) paths.push(`${entry.name}/${file.name}`);
  }

  console.log(`\n▸ Bucket "${BUCKET}": ${paths.length} arquivo(s)`);
  for (const p of paths.slice(0, 20)) console.log(`    ${p}`);
  if (paths.length > 20) console.log(`    … e mais ${paths.length - 20}`);

  if (!CONFIRMED) {
    console.log(`
Nada foi apagado.

Esses arquivos não são mais lidos pelo aplicativo: a fala do curso passou a ser
sintetizada no navegador. Para apagá-los de vez e remover o bucket:

  npm run cleanup:audio -- --yes

É irreversível.
`);
    return;
  }

  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) throw new Error(`Falha ao apagar os arquivos: ${removeError.message}`);
    console.log(`  ✓ ${paths.length} arquivo(s) apagado(s)`);
  }

  const { error: deleteError } = await supabase.storage.deleteBucket(BUCKET);
  if (deleteError) {
    console.log(`  ! Bucket não removido: ${deleteError.message}`);
    console.log(`    Apague em Storage no painel do Supabase, se quiser.`);
  } else {
    console.log(`  ✓ Bucket "${BUCKET}" removido`);
  }

  console.log("\n✓ Limpeza concluída.\n");
}

main().catch((error) => {
  console.error("\n✗ Erro na limpeza:", error instanceof Error ? error.message : error);
  process.exit(1);
});
