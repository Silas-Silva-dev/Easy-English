import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LiveRoom } from "@/components/live/live-room";
import { requireActiveUser } from "@/lib/auth/guards";
import {
  getNextLesson,
  getOrCreateEnrollment,
  getPrimaryCourse,
} from "@/lib/learning";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conversa ao vivo" };

/**
 * A sala de voz.
 *
 * ===========================================================================
 * POR QUE A TELA FICOU VAZIA
 * ===========================================================================
 * Ela tinha, de cima para baixo: um cabeçalho com três linhas de descrição, um
 * cartão com o cenário do circuito, a sala, um cartão "Como aproveitar" com
 * quatro parágrafos, a lista das últimas cinco conversas com notas, e um
 * rodapé sobre calibragem de nível. O botão que o aluno veio apertar era o
 * quinto elemento da página.
 *
 * Quem abre esta tela vem falar, não ler. E o que aqueles parágrafos
 * explicavam — o que a Emma faz, como pedir para ela parar de corrigir, que
 * ela fala no nível dele — ela agora DIZ na primeira frase da conversa, em
 * português, porque é isso que o modo Professora faz. Explicação que a
 * ferramenta dá sozinha não precisa de cartão.
 *
 * O histórico virou tela própria: ele é consulta, não é a chamada.
 */
export default async function LivePage() {
  const { userId } = await requireActiveUser("/app/ao-vivo");

  const course = await getPrimaryCourse();
  const enrollment = course
    ? await getOrCreateEnrollment(userId, course)
    : null;
  const lesson =
    course && enrollment
      ? await getNextLesson(course.id, enrollment.current_day)
      : null;

  const supabase = await createServerSupabase();

  const { data: circuit } = lesson?.week_number
    ? await supabase
        .from("circuits")
        .select("number, title, situation, live_prompt")
        .eq("number", lesson.week_number)
        .maybeSingle()
    : { data: null };

  return (
    <div className="relative flex min-h-[70vh] flex-col justify-center py-6">
      {/* Um toque, no canto, do jeito que um aplicativo de chamada guarda o
          registro: fora do caminho de quem veio falar. */}
      <Link
        href="/app/ao-vivo/historico"
        className="text-muted-foreground hover:bg-accent hover:text-foreground absolute top-0 right-0 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm transition-colors"
      >
        <History className="size-4" />
        <span className="max-sm:sr-only">Histórico</span>
      </Link>

      <LiveRoom
        lessonId={lesson?.id}
        circuitNumber={lesson?.week_number}
        scenario={circuit?.live_prompt ?? circuit?.situation ?? undefined}
        title={
          circuit ? `Circuito ${circuit.number} · ${circuit.title}` : undefined
        }
      />
    </div>
  );
}
