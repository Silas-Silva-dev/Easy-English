import { pronunciationOf } from "@/lib/pronunciation";
import { cn } from "@/lib/utils";

/**
 * A linha de pronúncia figurada, entre o inglês e a tradução.
 *
 * A ordem na tela é deliberada — inglês, som, sentido:
 *
 *     Nice to meet you.      <- o que está escrito
 *     náis ta mît iu.        <- como sai na boca
 *     Prazer em conhecer.    <- o que quer dizer
 *
 * Se a figuração viesse depois da tradução, o olho passaria direto: o aluno lê
 * o português e considera a linha resolvida. No meio, ela fica no caminho
 * entre a dúvida ("como se fala isso?") e a resposta.
 *
 * Não renderiza nada quando não há figuração para o texto — frase nova, ainda
 * sem rodada de `npm run gen:pronuncia`, some em silêncio em vez de mostrar
 * uma aproximação inventada.
 */
export function PronunciationLine({ text, className }: { text: string; className?: string }) {
  const said = pronunciationOf(text);
  if (!said) return null;

  return (
    <p
      // `lang="pt-BR"` importa de verdade: sem isso o leitor de tela tenta ler
      // "náis ta mît iu" com fonética inglesa e sai um ruído sem sentido.
      lang="pt-BR"
      className={cn("text-primary/85 mt-0.5 text-[0.8rem] tracking-wide italic", className)}
    >
      {said}
    </p>
  );
}
