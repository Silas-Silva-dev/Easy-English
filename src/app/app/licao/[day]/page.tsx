import { ArrowLeft, Clock, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  LessonPlayer,
  type ExposicaoDaLicao,
} from "@/components/lesson/lesson-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { audioSrc } from "@/lib/audio-id";
import { requireActiveUser } from "@/lib/auth/guards";
import {
  chaveDaPeca,
  estadoDe,
  semTextoTravado,
  type PapelDaExposicao,
} from "@/lib/exposicao";
import {
  getLessonByDay,
  getNextLesson,
  getOrCreateEnrollment,
  getPrimaryCourse,
  LESSON_KIND_LABEL,
} from "@/lib/learning";
import { getLastSpeakingResult } from "@/lib/speaking";
import { createServerSupabase } from "@/lib/supabase/server";
import type { LessonContent } from "@/lib/types/database";

import { escutasExigidas } from "@content/metodo";

interface Params {
  params: Promise<{ day: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { day } = await params;
  const course = await getPrimaryCourse();
  if (!course) return { title: `Dia ${day}` };

  const lesson = await getLessonByDay(course.id, Number(day));
  return {
    title: lesson ? `Dia ${lesson.day_number} · ${lesson.title}` : `Dia ${day}`,
  };
}

export default async function LessonPage({ params }: Params) {
  const { day: dayParam } = await params;
  const day = Number(dayParam);

  if (!Number.isInteger(day) || day < 1) notFound();

  const { userId, profile } = await requireActiveUser(`/app/licao/${dayParam}`);
  const course = await getPrimaryCourse();
  if (!course) notFound();

  const [lesson, enrollment] = await Promise.all([
    getLessonByDay(course.id, day),
    getOrCreateEnrollment(userId, course),
  ]);

  if (!lesson) notFound();

  function getCantoInfo(weekNumber: number) {
    if (weekNumber <= 13)
      return { href: `/app/curso?day=${day}`, label: "Voltar ao Curso (Canto 1: Destravar)" };
    if (weekNumber <= 26)
      return { href: `/app/curso?day=${day}`, label: "Voltar ao Curso (Canto 2: Contar)" };
    if (weekNumber <= 39)
      return { href: `/app/curso?day=${day}`, label: "Voltar ao Curso (Canto 3: Resolver)" };
    return { href: `/app/curso?day=${day}`, label: "Voltar ao Curso (Canto 4: Soar natural)" };
  }

  const cantoInfo = getCantoInfo(lesson.week_number);

  // Lição em rascunho só é visível para quem administra o conteúdo.
  if (!lesson.is_published) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={<Lock />}
          title="Esta lição ainda não foi publicada"
          description={`O conteúdo do dia ${day} está em preparação. Continue pelo seu cronograma normal.`}
          action={
            <Button asChild variant="outline">
              <Link href={cantoInfo.href}>{cantoInfo.label}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const supabase = await createServerSupabase();

  /**
   * Qual peça de material este dia apresenta.
   *
   * Quatro dias do circuito têm roteiro: 1 (imersão) e 9 (shadowing) escrevem
   * `immersion_script`; 4 (segunda escuta) e 12 (velocidade) escrevem
   * `listening_script`. Os dias 9 e 12 REAPRESENTAM a peça que o 1 e o 4
   * estrearam — o mesmo diálogo, byte a byte.
   *
   * Houve uma tentativa de montar o portão só onde havia bloco travado, o que
   * deixava 9 e 12 sem portão nenhum. O efeito foi pior que o problema: o dia 9
   * passou a servir o diálogo do dia 1 dentro de um `<details>` chamado "Ver a
   * transcrição", aberto num clique, alcançável pelo cronograma antes de o dia
   * 1 ter sido feito.
   *
   * Como a chave é do MATERIAL e não do dia, os quatro compartilham exposição:
   * quem cumpriu o dia 1 abre o dia 9 já destravado, e quem não cumpriu
   * encontra o portão nos dois. O dia 12 pede 1,25x e 1,5x no exercício, e isso
   * deixou de ser conflito: ele herda a exposição do dia 4, que já estava
   * aberta quando ele chega.
   */
  const papel: PapelDaExposicao | null = lesson.immersion_script
    ? "imersao"
    : lesson.listening_script
      ? "escuta"
      : null;

  /**
   * A chave é do MATERIAL, não do dia que o mostra.
   *
   * A peça de imersão nasce no dia 1 e reaparece no dia 9 (shadowing); a de
   * escuta nasce no dia 4 e volta no dia 12. Chavear por dia daria
   * `c1d9:imersao` como linha nova, e o aluno teria de ouvir quatro vezes de
   * novo, no exercício em que ele precisa do texto para falar junto, um
   * diálogo que ele já destravou oito dias antes.
   */
  const diaDeOrigem = papel === "imersao" ? 1 : 4;
  const chave = papel
    ? chaveDaPeca(lesson.week_number, diaDeOrigem, papel)
    : null;

  const [{ data: progress }, nextLesson, speakingResult, { data: exposicao }] =
    await Promise.all([
      enrollment
        ? supabase
            .from("lesson_progress")
            .select("status, quiz_answers, score")
            .eq("enrollment_id", enrollment.id)
            .eq("lesson_id", lesson.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      getNextLesson(course.id, day + 1),
      // A fala já corrigida volta com a lição: o aluno reabre e continua vendo o
      // próprio áudio e a avaliação da tutora, em vez de recomeçar do zero.
      lesson.speaking_prompt
        ? getLastSpeakingResult(userId, lesson.id)
        : Promise.resolve(null),
      // O estado do portão é do par (aluno, peça), não da sessão do navegador:
      // quem já cumpriu as escutas e deu F5 não é mandado ouvir tudo de novo.
      chave
        ? supabase
            .from("listening_exposures")
            .select("*")
            .eq("user_id", userId)
            .eq("exposure_key", chave)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // `escutasExigidas` só vale para a primeira montagem, antes de existir linha:
  // uma vez criada, o número que manda é o que o SERVIDOR gravou em
  // `required_plays`, e é `estadoDe` que aplica essa precedência. Importar o
  // método aqui é de graça — isto é Server Component e nada disso vai para o
  // bundle do navegador.
  const estado = chave
    ? estadoDe(chave, exposicao, escutasExigidas(lesson.week_number))
    : null;

  /** O roteiro que a peça travada toca — e que não pode viajar com ela. */
  const roteiroDaPeca =
    papel === "imersao" ? lesson.immersion_script : lesson.listening_script;

  const exposure: ExposicaoDaLicao | null =
    estado && papel
      ? {
          papel,
          key: estado.chave,
          requiredPlays: estado.exigidas,
          initialPlays: estado.escutas,
          unlocked: estado.desbloqueada,
          blocks: estado.desbloqueada ? (lesson.content.gated ?? []) : [],
          audioExempt: profile.audio_exempt,
          // Travada, o player recebe o ENDEREÇO e não o texto. `audioSrc` deriva
          // o nome do arquivo do próprio roteiro, então mandar o roteiro para o
          // player calcular o endereço devolveria a transcrição ao payload — que
          // é exatamente o defeito. Aberta, o texto pode ir: já foi ouvido.
          audioUrl: estado.desbloqueada ? null : audioSrc(roteiroDaPeca ?? ""),
        }
      : null;

  /**
   * A lição que o navegador recebe.
   *
   * `content.gated` ia INTEIRO no payload e o React apenas deixava de
   * renderizar: bastava abrir o inspetor, ou o view-source, para ler a
   * transcrição completa antes da primeira escuta — e ler antes de ouvir é o
   * hábito que o portão existe para impedir. Com a exposição fechada a cópia
   * sai sem o texto travado; os blocos chegam depois, pela server action,
   * quando `count_listen` confirmar a última escuta.
   *
   * O ROTEIRO SAI JUNTO, e essa é a metade que faltava. `immersion_script` e
   * `listening_script` são colunas de topo, e são a transcrição: tirar só
   * `content.gated` deixava no payload o mesmo diálogo em inglês, sem a
   * tradução e sem a formatação. O portão passaria a esconder a apresentação
   * do texto, não o texto. O player não precisa dele: recebe `audioUrl`.
   */
  const licaoDoAluno =
    exposure && !exposure.unlocked
      ? semTextoTravado(lesson, exposure.papel)
      : lesson;

  // Reidrata as respostas do quiz salvas no banco para que o aluno que reabrir
  // uma lição já concluída veja suas respostas e as correções sem precisar
  // refazer o quiz do zero.
  const savedAnswers =
    progress?.status === "completed" && Array.isArray(progress.quiz_answers)
      ? Object.fromEntries(
          (progress.quiz_answers as number[]).map(
            (answer, i) => [i, answer] as [number, number],
          ),
        )
      : {};

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header className="space-y-3">
        <Link
          href={cantoInfo.href}
          className="text-muted-foreground hover:text-foreground -ml-2 inline-flex min-h-10 items-center gap-1.5 px-2 text-sm transition-colors"
        >
          <ArrowLeft className="size-3.5" /> {cantoInfo.label}
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Badge>Dia {lesson.day_number}</Badge>
          <Badge variant="neutral">{LESSON_KIND_LABEL[lesson.kind]}</Badge>
          <Badge variant="neutral">{lesson.level}</Badge>
          <Badge variant="neutral">
            <Clock className="size-3" /> {lesson.estimated_minutes} min
          </Badge>
          <Badge variant="neutral">
            Circuito {lesson.week_number} · dia {lesson.circuit_day} de 14
          </Badge>
          {progress?.status === "completed" ? (
            <Badge variant="success">Concluída</Badge>
          ) : null}
        </div>

        <div>
          <h1 className="text-2xl leading-tight font-semibold sm:text-3xl">
            {lesson.title}
          </h1>
          {lesson.objective ? (
            <p className="text-muted-foreground mt-2 leading-relaxed">
              {lesson.objective}
            </p>
          ) : null}
        </div>
      </header>

      <LessonPlayer
        lesson={licaoDoAluno}
        exposure={exposure}
        alreadyCompleted={progress?.status === "completed"}
        nextPublishedDay={nextLesson?.day_number ?? null}
        initialSpeakingResult={speakingResult}
        initialAnswers={savedAnswers}
      />
    </div>
  );
}
