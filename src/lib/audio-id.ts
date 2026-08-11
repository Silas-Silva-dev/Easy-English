/**
 * Identidade estável de um áudio pré-gerado.
 *
 * ===========================================================================
 * POR QUE UM HASH E NÃO UMA TABELA
 * ===========================================================================
 * O áudio das lições é gerado em lote por `scripts/generate-audio.ts` e vive
 * como arquivo estático em `public/audio/<id>.mp3`. O player precisa descobrir
 * o nome do arquivo a partir do texto que ele já tem em mãos: sem consultar
 * banco, sem baixar manifesto, sem mudar o schema.
 *
 * Derivar o nome do próprio texto resolve isso e ainda dá três propriedades
 * que uma tabela de-para não daria:
 *
 *   - Geração retomável: o arquivo existir É a marca de "já foi feito". Não há
 *     estado separado para corromper nem para sincronizar.
 *   - Invalidação automática: corrigiu uma fala do roteiro? O texto mudou, o
 *     hash mudou, e o lote seguinte gera o áudio novo. O antigo simplesmente
 *     deixa de ser pedido.
 *   - Degradação limpa: enquanto o arquivo não existir, o player cai na voz do
 *     navegador. O app funciona igual do primeiro dia de geração ao último.
 *
 * ===========================================================================
 * POR QUE ESTA FUNÇÃO E NÃO SHA-256
 * ===========================================================================
 * Precisa rodar igual no Node (script de geração) e no browser (player), de
 * forma SÍNCRONA. `crypto.subtle` no browser é assíncrono, e um await aqui
 * voltaria a quebrar o gesto do usuário no Safari: o mesmo problema que
 * `src/lib/speech.ts` documenta. Este é o cyrb53, que é síncrono, não depende
 * de nada e distribui bem o suficiente: com ~500 áudios, a chance de colisão
 * em 53 bits é da ordem de 1 em 10^11.
 */

/** Normaliza antes de somar, para espaço sobrando não gerar arquivo novo. */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function audioId(text: string): string {
  const input = normalize(text);
  if (!input) return "";

  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Onde o áudio do curso mora.
 *
 * Morava em `public/audio/<id>.mp3`, versionado no git. Funcionou enquanto o
 * curso tinha 364 blocos e 500 arquivos. A reconstrução do método pede cerca de
 * 13 mil arquivos e 314 MB, e repositório não é servidor de mídia: clonar o
 * projeto passaria a baixar um terço de gigabyte de mp3, e cada regeração de
 * conteúdo somaria outra cópia ao histórico, para sempre.
 *
 * Agora sai do bucket `course-audio` do Supabase (ver a migração
 * `20260101001300`). A propriedade que fazia esta função existir continua
 * intacta: ela é SÍNCRONA e deriva o endereço do próprio texto, sem consultar
 * banco e sem await, que é o que mantém o play funcionando dentro do gesto do
 * usuário no Safari.
 *
 * O caminho local continua como reserva para quando a variável não existir —
 * desenvolvimento sem Supabase configurado, e os testes. E quando o arquivo não
 * existir em lugar nenhum, o player cai na voz do navegador, exatamente como
 * fazia no primeiro dia de geração.
 */
const BASE_REMOTA = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-audio`
  : null;

export function audioSrc(text: string): string | null {
  const id = audioId(text);
  if (!id) return null;
  return BASE_REMOTA ? `${BASE_REMOTA}/${id}.mp3` : `/audio/${id}.mp3`;
}
