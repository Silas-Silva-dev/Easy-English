"use client";

import { AlertTriangle, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import * as React from "react";

import {
  contarEscutaAction,
  dispensarAudioAction,
  type RespostaDeEscuta,
} from "@/app/app/licao/actions";
import { Button } from "@/components/ui/button";
import { audioSrc } from "@/lib/audio-id";
import {
  cancelSpeech,
  isSpeechSupported,
  parseScript,
  primeVoices,
  speakLines,
  type SpeakLine,
} from "@/lib/speech";
import type { LessonBlock } from "@/lib/types/database";
import { cn } from "@/lib/utils";

/**
 * Velocidades de treino.
 *
 * 0,75x existe para a primeira escuta de iniciante; 1,25x e 1,5x existem
 * porque depois de treinar acelerado a velocidade normal do nativo soa
 * devagar: é o mesmo princípio de treinar com peso e competir sem.
 */
const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

/** Segundos em m:ss. Faixa nenhuma do curso passa de uma hora. */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Onde os segundos ouvidos da sessão se somam.
 *
 * `study_days.input_minutes` é a coluna que 52 dos 52 portões do Completo leem
 * em "11 dos 14 dias com o input da sessão registrado", e ela precisa de uma
 * fonte MEDIDA — relógio de parede da aba aberta não serve: o aluno pode ficar
 * quarenta minutos com o fone na mesa. A fonte medida é a cobertura de cada
 * player, e cada player está sete níveis abaixo de quem faz a conta do dia.
 *
 * Um contexto em vez de um callback atravessando `LessonPlayer` →
 * `LessonBlockView` → `PronunciationLine` → `AudioPlayer`: assim qualquer
 * player montado dentro da lição soma, inclusive os que ainda não existem.
 * Fora de uma lição o contexto é nulo e nada acontece.
 */
export const EscutaMedida = React.createContext<
  ((segundos: number) => void) | null
>(null);

export interface AudioPlayerProps {
  /** O texto a falar. Diálogos usam o formato "NOME: fala / NOME: fala". */
  text: string;
  /** Diálogo alterna duas vozes; single usa uma só. */
  mode?: "single" | "dialogue";
  label?: string;
  /** Esconde o seletor de velocidade (blocos curtos não precisam). */
  compact?: boolean;
  /** Repete indefinidamente: usado no shadowing. */
  loop?: boolean;
  className?: string;
  onEnded?: () => void;
  /**
   * Uma escuta COMPLETA a mais: chamada quando a faixa chega ao fim, nunca no
   * clique do play. `seconds` é a duração da faixa arredondada, e 0 quando não
   * há duração conhecida — a síntese do navegador não tem linha do tempo. É
   * esse número que o portão manda ao servidor como janela de idempotência.
   */
  onPlayCountChange?: (count: number, seconds: number) => void;
  /**
   * O endereço do áudio, quando o TEXTO não pode viajar até o navegador.
   *
   * Uma peça travada não manda o roteiro: `audioSrc` derivaria o nome do
   * arquivo do próprio texto, e mandar o texto para derivar o nome anula o
   * portão — a transcrição estaria no payload, que é o defeito que o portão
   * existe para consertar. O servidor calcula o endereço e manda só ele.
   *
   * O preço é que não há queda para a voz do navegador nesse caso: sem texto
   * não há o que sintetizar. Vale, porque todas as peças do curso têm arquivo
   * gerado, e o portão que não pode ser cumprido aparece na tela em vez de
   * abrir sozinho.
   */
  srcOverride?: string | null;
}

export function AudioPlayer({
  text,
  mode = "single",
  label,
  compact = false,
  loop = false,
  className,
  onEnded,
  onPlayCountChange,
  srcOverride,
}: AudioPlayerProps) {
  const somarEscuta = React.useContext(EscutaMedida);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState<number>(1);
  const [plays, setPlays] = React.useState(0);
  // O contador tambem vive num ref: avisar o pai (o portao de escuta) de dentro
  // do updater do setState conta escuta dobrada em StrictMode.
  const playsRef = React.useRef(0);
  /**
   * A velocidade também vive num ref.
   *
   * Quem conta a escuta é o `onended` montado lá no play, e ele leria a
   * velocidade daquele momento: passar para 1,5x no meio da passada contaria a
   * passada acelerada como se fosse ritmo normal, que é exatamente o que a
   * guarda abaixo existe para recusar.
   */
  const speedRef = React.useRef(1);

  /**
   * ===========================================================================
   * O MEDIDOR: QUE PEDAÇOS da faixa passaram pelo alto-falante
   * ===========================================================================
   * Duas tentativas anteriores erraram a pergunta, e vale registrar as duas
   * porque a terceira só faz sentido contra elas.
   *
   *   1. "A barra pulou?" — um booleano derrubado quando o aluno arrastasse
   *      para a frente além de uma folga. A barra é um `input range` de MIL
   *      passos: segurar a seta direita atravessa a faixa inteira sem um único
   *      salto grande o bastante, e o `onended` dispara para quem não ouviu
   *      nada.
   *
   *   2. "Passou tempo?" — relógio de parede acumulado enquanto tocava. Segurar
   *      a seta ESQUERDA puxa a reprodução de volta ao início a cada tecla: o
   *      áudio toca o primeiro segundo em laço, o relógio corre normalmente, e
   *      no fim a passada é aprovada. Pior: uma síntese cancelada por outro
   *      player deixava o relógio correndo, e a próxima pausa despejava minutos
   *      inteiros dentro do contador.
   *
   * A pergunta certa não é sobre a barra nem sobre o tempo: é se O ÁUDIO
   * ANDOU. `cobertaRef` guarda quais dos 100 pedaços da faixa já foram
   * alcançados pela reprodução, marcados no `timeupdate` — o evento que só o
   * avanço real dispara. Voltar e reouvir marca de novo (escutar mais não é
   * escutar menos); pular para o fim marca UM pedaço; tocar o primeiro segundo
   * em laço marca UM pedaço. A passada só conta com 85% da faixa marcada.
   *
   * As duas guardas do método continuam, agora aplicadas na hora de MARCAR:
   * acima de 1,0x não marca (treinar acelerado é outro exercício, e o dia 12
   * pede 1,25x depois de a passagem já ter entrado pelo ouvido) e aba escondida
   * não marca (som em segundo plano enquanto se lê outra coisa).
   *
   * Na voz do navegador, que não tem linha do tempo, o pedaço é a FALA: o
   * `onLine` marca a linha que está sendo dita, e o corte de 85% vale igual.
   * É por isso que um bloco de uma frase só passa dizendo aquela frase, em vez
   * de ser reprovado por um piso de segundos que ele nunca alcançaria.
   */
  const PEDACOS = 100;
  const cobertaRef = React.useRef<Set<number>>(new Set());
  /** Onde a reprodução estava no `timeupdate` anterior, em segundos. */
  const ultimoTempoRef = React.useRef(0);
  /** Houve salto desde o último `timeupdate`? Então o trecho não foi tocado. */
  const pulouRef = React.useRef(false);

  /**
   * Marca o pedaço `indice` de `total` como alcançado.
   *
   * As duas guardas ficam aqui, e não na hora de contar: assim a faixa ouvida
   * em 1x conta mesmo que o aluno experimente 1,25x nos últimos segundos, e a
   * faixa ouvida acelerada não conta mesmo que ele volte para 1x antes do fim.
   * O que vale é a condição no instante em que o som saiu.
   */
  const marcar = React.useCallback((indice: number, total: number) => {
    if (speedRef.current > 1) return;
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    )
      return;
    if (!(total > 0) || !Number.isFinite(indice)) return;
    cobertaRef.current.add(
      Math.min(total - 1, Math.max(0, Math.floor(indice))),
    );
  }, []);

  /**
   * Marca o TRECHO percorrido entre dois `timeupdate`, e não o ponto.
   *
   * Marcar só o ponto reprovava faixa curta: `timeupdate` dispara umas quatro
   * vezes por segundo, então um bloco de três segundos produz doze eventos e
   * marcaria doze dos cem pedaços — 12% de cobertura numa escuta impecável, e a
   * recusa apareceria na tela acusando o aluno. Marcando o intervalo, a mesma
   * escuta cobre os cem.
   *
   * O salto é o que separa tocar de arrastar. Qualquer `seeked` — mouse,
   * teclado ou a nossa própria barra — levanta `pulouRef`, e o intervalo
   * seguinte é descartado em vez de preenchido: senão segurar a seta direita
   * pintaria a faixa inteira sem um segundo de som. O mesmo vale para o salto
   * grande que escapa do evento: intervalo acima de dois segundos entre dois
   * `timeupdate` não é reprodução, é pulo.
   */
  const cobrirTrecho = React.useCallback(
    (de: number, ate: number, duracao: number) => {
      if (!(duracao > 0)) return;
      const avanco = ate - de;
      if (avanco <= 0 || avanco > 2) return;
      const primeiro = Math.floor((de / duracao) * PEDACOS);
      const ultimo = Math.floor((ate / duracao) * PEDACOS);
      for (let i = primeiro; i <= ultimo; i++) marcar(i, PEDACOS);
    },
    [marcar],
  );

  const zerarCobertura = React.useCallback(() => {
    cobertaRef.current = new Set();
    ultimoTempoRef.current = audioRef.current?.currentTime ?? 0;
    pulouRef.current = false;
  }, []);

  /** Por que a última passada não contou. Vai para a tela, não para o console. */
  const [recusa, setRecusa] = React.useState<string | null>(null);
  const [lineIndex, setLineIndex] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [supported, setSupported] = React.useState(true);

  const lines: SpeakLine[] = React.useMemo(
    () => (mode === "dialogue" ? parseScript(text) : [{ text }]),
    [text, mode],
  );

  /**
   * Áudio pré-gerado, quando existir.
   *
   * `scripts/generate-audio.ts` grava os diálogos e blocos em `public/audio/`
   * com voz neural: fala conectada de verdade, que a voz do sistema
   * operacional não produz. Enquanto o lote não termina, cada arquivo que já
   * existe passa a ser usado e o resto continua na voz do navegador, sem o
   * aluno perceber a transição.
   */
  const src = React.useMemo(
    () => srcOverride ?? audioSrc(text),
    [text, srcOverride],
  );
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  /**
   * Três estados, e não um booleano.
   *
   * Havia `hasFile: boolean` começando em `false`, virando `true` só quando o
   * `loadedmetadata` da sondagem chegasse. Quem apertasse o play ANTES disso
   * caía na voz do navegador mesmo com o arquivo do Piper no servidor — sem
   * erro, sem aviso, sem jeito de perceber.
   *
   * A janela não é teórica: o dia 2 monta SETE players de uma vez e o
   * navegador só abre 6 conexões por host, então a última sondagem entra na
   * fila. Pior no iPhone, onde o Safari ignora `preload` até haver gesto do
   * usuário: ali o `loadedmetadata` NUNCA chegava antes do clique, e todo bloco
   * tocava na voz do sistema.
   *
   * Agora "ainda não sei" é otimista: tenta o arquivo e só cai na síntese se
   * ele realmente falhar. "absent" continua indo direto para a síntese, o que
   * preserva o gesto do usuário no Safari para os textos sem áudio gravado.
   */
  const [fileState, setFileState] = React.useState<
    "unknown" | "present" | "absent"
  >("unknown");
  const hasFile = fileState !== "absent";
  /** 0 a 1. Vale para os dois caminhos: tempo no arquivo, fala na síntese. */
  const [progress, setProgress] = React.useState(0);
  /** Segundos. Zero quando não há arquivo: a síntese não sabe a duração. */
  const [duration, setDuration] = React.useState(0);

  // As vozes precisam estar em cache ANTES do clique: no Safari e no Chrome do
  // celular, o play só produz som se `speak()` for chamado dentro do gesto,
  // sem espera pelo meio. Ver `primeVoices` em @/lib/speech.
  React.useEffect(() => {
    setSupported(isSpeechSupported());
    primeVoices();
  }, []);

  // Sair da página no meio de uma fala deixaria a voz tocando sozinha.
  React.useEffect(() => cancelSpeech, []);

  /**
   * Sonda o arquivo na montagem, não no clique: assim, quando o aluno aperta o
   * play, já sabemos qual caminho tomar e o `play()` sai dentro do gesto: * exigência do Safari, a mesma que `@/lib/speech` documenta.
   */
  React.useEffect(() => {
    setProgress(0);
    setDuration(0);
    if (!src) {
      setFileState("absent");
      return;
    }
    setFileState("unknown");

    const audio = new Audio();
    audio.preload = "metadata";

    const found = () => {
      setFileState("present");
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const missing = () => setFileState("absent");
    // O progresso é escutado aqui, e não em `play()`: assim a barra também
    // acompanha quando o aluno arrasta com o áudio pausado.
    const tick = () =>
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);

    // `timeupdate` durante a reprodução é a ÚNICA evidência de que o som
    // avançou. `seeked` de propósito não marca: arrastar não é ouvir.
    const cobrir = () => {
      const agora = audio.currentTime;
      if (audio.paused || audio.seeking || pulouRef.current) {
        pulouRef.current = false;
        ultimoTempoRef.current = agora;
        return;
      }
      cobrirTrecho(ultimoTempoRef.current, agora, audio.duration);
      ultimoTempoRef.current = agora;
    };
    const pulou = () => {
      pulouRef.current = true;
      ultimoTempoRef.current = audio.currentTime;
    };

    audio.addEventListener("loadedmetadata", found);
    audio.addEventListener("error", missing);
    audio.addEventListener("timeupdate", tick);
    audio.addEventListener("timeupdate", cobrir);
    audio.addEventListener("seeked", tick);
    audio.addEventListener("seeking", pulou);
    audio.addEventListener("seeked", pulou);
    audio.src = src;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", found);
      audio.removeEventListener("error", missing);
      audio.removeEventListener("timeupdate", tick);
      audio.removeEventListener("timeupdate", cobrir);
      audio.removeEventListener("seeked", tick);
      audio.removeEventListener("seeking", pulou);
      audio.removeEventListener("seeked", pulou);
      audioRef.current = null;
    };
  }, [src, cobrirTrecho]);

  React.useEffect(() => {
    cancelSpeech();
    audioRef.current?.pause();
    setPlaying(false);
    setLineIndex(0);
    setProgress(0);
    zerarCobertura();
    setRecusa(null);
  }, [text, zerarCobertura]);

  /**
   * Uma escuta a mais — e só quando a faixa chegou ao fim TENDO SIDO OUVIDA.
   *
   * Isto era chamado no clique do play: quatro cliques em quatro segundos
   * destravavam o texto do dia 1 sem que uma única frase fosse ouvida, porque
   * o contador media intenção de tocar.
   *
   * O corte é 85% da duração, e não 100%: o `onended` chega alguns décimos
   * depois do último `timeupdate`, trocar de velocidade no meio encurta o
   * relógio, e exigir a faixa exata reprovaria quem ouviu tudo. Abaixo de 85%
   * não há passada — há barra arrastada, aba escondida ou 1,5x.
   *
   * `seconds` é o que foi medido, e é ele que vira `study_days.input_minutes`
   * lá em cima. Também é a janela que `count_listen` usa para não contar duas
   * vezes a mesma passada.
   */
  const countListen = React.useCallback(
    (duracaoDaFaixa: number, pedacos: number) => {
      const cobertos = cobertaRef.current.size;
      zerarCobertura();

      const fracao = pedacos > 0 ? cobertos / pedacos : 0;

      if (fracao < 0.85) {
        setRecusa(
          speedRef.current > 1
            ? "Acima de 1x não conta como primeira escuta. Ouça em 1x ou 0,75x."
            : typeof document !== "undefined" &&
                document.visibilityState !== "visible"
              ? "A faixa terminou com a tela em outro lugar. Deixe esta aba à frente enquanto ouve."
              : "Esta passada não foi ouvida inteira. Toque de novo, sem pular trechos.",
        );
        return;
      }

      setRecusa(null);
      // Os segundos são a fração coberta da faixa, não relógio de sessão: é o
      // que vira `study_days.input_minutes`. Sem duração (voz do navegador) vai
      // zero, e o dia entra no portão como dia sem input — que é a resposta
      // certa, porque ali não há como medir.
      const segundos =
        duracaoDaFaixa > 0 ? Math.floor(duracaoDaFaixa * fracao) : 0;
      somarEscuta?.(segundos);

      const next = playsRef.current + 1;
      playsRef.current = next;
      setPlays(next);
      onPlayCountChange?.(next, segundos);
    },
    [onPlayCountChange, somarEscuta, zerarCobertura],
  );

  /**
   * Fala a partir de uma linha, no ritmo pedido.
   *
   * A síntese do navegador não tem linha do tempo: não dá para buscar o
   * segundo 12. A fala é a menor unidade que dá para retomar, e é ela que
   * sustenta tanto o "voltar um trecho" quanto a troca de velocidade sem
   * perder o lugar.
   */
  const speakFrom = React.useCallback(
    (index: number, rate = speed) => {
      speakLines(lines, {
        rate,
        startAt: index,
        onLine: (i, total) => {
          setLineIndex(i);
          setProgress(total ? (i + 1) / total : 0);
          // Na voz do navegador o pedaço é a fala: é aqui que a cobertura é
          // marcada, e é por isso que arrastar a barra na síntese (que salta
          // para outra linha) não fabrica passada.
          marcar(i, total);
        },
        onEnd: () => {
          setLineIndex(0);
          setProgress(0);
          setPlaying(false);
          // Zero segundos: a síntese não conhece a própria duração, e o
          // servidor aplica a janela mínima dele. A condição existe porque
          // `speakLines` chama `onEnd` na hora quando não há nada a falar —
          // contar ali seria contar silêncio.
          if (lines.length) countListen(0, lines.length);
          onEnded?.();
        },
        onError: (message) => {
          setError(message);
          setPlaying(false);
        },
      });
    },
    [lines, speed, onEnded, countListen, marcar],
  );

  /**
   * Prepara o elemento e toca. Usado por `play` e por `restart`, para o
   * `onended` nunca ficar sem dono: sem ele o áudio acaba e o botão fica
   * preso em "pausar" para sempre.
   */
  const playFile = React.useCallback(
    (audio: HTMLAudioElement, resumeLine: number) => {
      audio.playbackRate = speed;
      // Com `loop` ligado (shadowing) o `onended` nunca dispara, e é por isso
      // que o shadowing não conta escuta: repetição sem fim não é uma passada.
      audio.loop = loop;
      audio.onended = () => {
        // Rebobina para o próximo play, mas só DEPOIS de ter tocado inteiro: // é isso que separa "acabou" de "pausei".
        audio.currentTime = 0;
        setProgress(0);
        setPlaying(false);
        // `audio.duration` em vez do estado `duration`: no caminho otimista
        // ("unknown") o play sai antes do `loadedmetadata`, e o estado ainda
        // valeria 0 quando esta passada terminasse.
        countListen(
          Number.isFinite(audio.duration) ? audio.duration : 0,
          PEDACOS,
        );
        onEnded?.();
      };
      void audio.play().catch(() => {
        // O arquivo não existe ou não decodifica. A partir daqui este player
        // usa a síntese, sem tentar de novo a cada clique.
        setFileState("absent");
        speakFrom(resumeLine);
      });
    },
    [speed, loop, onEnded, speakFrom, countListen],
  );

  /** Toca de onde parou. NÃO rebobina: quem rebobina é `restart`. */
  const play = React.useCallback(() => {
    setError(null);
    setPlaying(true);
    setRecusa(null);

    const audio = audioRef.current;
    if (hasFile && audio) {
      playFile(audio, lineIndex);
      return;
    }

    speakFrom(lineIndex);
  }, [hasFile, lineIndex, playFile, speakFrom]);

  function pause() {
    setPlaying(false);
    const audio = audioRef.current;
    if (hasFile && audio) {
      // `pause()` puro: a posição fica onde está e o próximo play continua dali.
      audio.pause();
      return;
    }
    // Na voz do navegador, `speechSynthesis.pause()` é irregular entre
    // navegadores. Paramos e guardamos a LINHA: retomar refala a partir dela,
    // que é previsível em todo lugar.
    cancelSpeech();
  }

  function toggle() {
    if (playing) {
      pause();
      return;
    }
    play();
  }

  function restart() {
    cancelSpeech();
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
    setLineIndex(0);
    setProgress(0);
    // Recomeçar zera a cobertura: os pedaços da passada abandonada não se
    // somam aos da nova, senão duas meias-escutas viravam uma.
    zerarCobertura();
    setRecusa(null);
    // O estado de `lineIndex` só chega no próximo render; `play` ainda leria o
    // valor antigo. Por isso o caminho da voz do navegador é chamado direto.
    setError(null);
    setPlaying(true);
    if (hasFile && audio) playFile(audio, 0);
    else speakFrom(0);
  }

  /** Vai para um ponto da faixa. `fraction` é 0 a 1. */
  function seek(fraction: number) {
    const f = Math.min(Math.max(fraction, 0), 1);
    // A barra não decide nada sobre a contagem: quem mede é a cobertura, e
    // arrastar marca no máximo o pedaço de destino. Ver `cobertaRef`.
    const audio = audioRef.current;

    if (hasFile && audio) {
      if (audio.duration) audio.currentTime = f * audio.duration;
      setProgress(f);
      return;
    }

    // Sem arquivo, o alvo é a fala mais próxima.
    if (!lines.length) return;
    const line = Math.min(lines.length - 1, Math.floor(f * lines.length));
    setLineIndex(line);
    setProgress((line + 1) / lines.length);
    if (playing) speakFrom(line);
  }

  function changeSpeed(next: number) {
    setSpeed(next);
    speedRef.current = next;

    const audio = audioRef.current;
    if (hasFile && audio) {
      // Com arquivo a velocidade muda AO VIVO, tocando ou pausado: que é o
      // ponto do dia 12 (escuta acelerada): ouvir o efeito na mesma passagem.
      audio.playbackRate = next;
      return;
    }

    // Na voz do navegador a fala em curso já foi enfileirada no ritmo antigo.
    // Refalamos da MESMA linha no ritmo novo, em vez de largar o aluno parado.
    if (playing) speakFrom(lineIndex, next);
  }

  const progressPct = progress * 100;
  const elapsed = duration ? duration * progress : 0;

  // Só é "indisponível" quando não há NEM arquivo NEM síntese: com o áudio
  // pré-gerado a lição funciona até em navegador sem Web Speech.
  // Só é "indisponível" quando não há NEM arquivo NEM nada a sintetizar. Sem
  // texto (peça travada, que recebe só o endereço) a síntese não é reserva
  // nenhuma, então o arquivo faltando é o fim da linha e precisa aparecer.
  if (fileState === "absent" && (!supported || !lines.length)) {
    return (
      <div
        className={cn(
          "bg-muted/40 rounded-xl border border-dashed p-4",
          className,
        )}
      >
        <p className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="text-streak size-4 shrink-0" /> Áudio
          indisponível {lines.length ? "neste navegador" : "agora"}
        </p>
        <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
          {lines.length
            ? "A fala do curso é sintetizada pelo próprio navegador. Chrome, Edge e Safari funcionam; alguns navegadores alternativos não. O texto abaixo continua disponível."
            : "A gravação desta peça não carregou. Recarregue a página; se continuar assim, avise o suporte — este trecho só abre pelo áudio, e não vamos abrir o texto sem ele."}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl border p-4", className)}>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          variant={playing ? "secondary" : "default"}
          onClick={toggle}
          aria-label={playing ? "Pausar" : progress > 0 ? "Continuar" : "Ouvir"}
          className="shrink-0"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Volume2 className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate text-sm font-medium">
              {label ?? "Ouvir"}
            </span>
            {plays > 0 ? (
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {plays}x
              </span>
            ) : null}
          </div>

          {/* Barra clicável e arrastável. É um `input range` de verdade, e não
              uma div pintada, para funcionar também no teclado (setas) e para
              o leitor de tela anunciar a posição. O preenchimento vem de um
              gradiente sobre a própria trilha: ver `.seek` em globals.css. */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(progressPct * 10)}
              onChange={(e) => seek(Number(e.target.value) / 1000)}
              aria-label="Posição na faixa"
              aria-valuetext={
                duration
                  ? `${formatTime(elapsed)} de ${formatTime(duration)}`
                  : `${Math.round(progressPct)}%`
              }
              className="seek min-w-0 flex-1"
              style={{ "--seek": `${progressPct}%` } as React.CSSProperties}
            />
            {duration ? (
              <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                {formatTime(elapsed)} / {formatTime(duration)}
              </span>
            ) : null}
          </div>
        </div>

        {plays > 0 || progress > 0 ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={restart}
            aria-label="Recomeçar"
            className="shrink-0"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {!compact ? (
        // flex-wrap: em 320px os quatro botões não cabem ao lado do rótulo.
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Velocidade</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSpeed(s)}
              className={cn(
                // min-h/min-w 10: errar o vizinho reinicia a fala em curso.
                "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md px-2.5 text-xs font-medium tabular-nums transition-colors",
                speed === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-destructive mt-3 text-xs leading-relaxed">{error}</p>
      ) : null}

      {/* A passada recusada precisa DIZER por que foi recusada. Sem isto, o
          aluno de celular que ouve com a tela bloqueada vê o contador parado em
          "Escuta 1 de 4" para sempre, sem nenhuma pista, e o portão vira uma
          parede sem porta — que é pior que o portão de enfeite que ele
          substituiu. */}
      {recusa && !error ? (
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          {recusa}
        </p>
      ) : null}
    </div>
  );
}

export interface ImmersionGateProps {
  /**
   * O roteiro que o player toca — vazio enquanto a peça está travada.
   *
   * O roteiro É a transcrição. Mandá-lo para o cliente calcular o endereço do
   * mp3 devolveria ao payload o texto que o portão esconde, então travada ela
   * recebe `audioUrl` e nada mais.
   */
  text: string;
  /** O endereço do mp3, quando o roteiro não pôde viajar. */
  audioUrl: string | null;
  /** Dia da lição, 1 a 728. Vai para a server action. */
  day: number;
  /** `chaveDaPeca(circuito, diaDoCircuito, papel)`. */
  exposureKey: string;
  /** Só para a primeira montagem: o servidor manda o valor que aplicou. */
  requiredPlays: number;
  initialPlays: number;
  /** Já veio destravada do servidor. */
  unlocked: boolean;
  /** Vazio quando travada — o texto não viaja antes da escuta. */
  initialBlocks: LessonBlock[];
  /** `profiles.audio_exempt`. */
  audioExempt: boolean;
  renderBlocks: (blocks: LessonBlock[]) => React.ReactNode;
  /**
   * A peça acabou de abrir.
   *
   * Quem guarda o "abriu" é o PAI, não este componente. O passo da lição é
   * desmontado ao trocar de aba (`step === "content" ? … : null`), e um estado
   * local voltaria a `unlocked=false` com as props do carregamento da página:
   * o aluno cumpria as quatro escutas, clicava em "Blocos", voltava, e
   * encontrava o portão fechado de novo — agora sem nenhum botão de saída.
   */
  onUnlocked?: (blocos: LessonBlock[]) => void;
}

/**
 * Portão de imersão: o texto só existe no navegador depois de N escutas.
 *
 * Não é gamificação: é o método. Ler antes de ouvir cola a pronúncia do
 * português nas letras, e isso é bem mais difícil de desfazer depois.
 *
 * O portão vivia em `useState(0)` com um botão "Mostrar o texto agora": um F5
 * zerava a contagem, e um clique abria tudo. Portão com botão de pular é
 * conselho com animação. Agora cada escuta é uma linha em
 * `listening_exposures`, quantas escutas a peça exige é o que o servidor
 * aplicou (`public.required_plays`, pelo circuito da própria chave), e os
 * blocos travados só chegam na resposta que disse que a exposição abriu — até
 * ali não há texto no cliente para o inspetor mostrar.
 */
export function ImmersionGate({
  text,
  audioUrl,
  day,
  exposureKey,
  requiredPlays,
  initialPlays,
  unlocked,
  initialBlocks,
  audioExempt,
  renderBlocks,
  onUnlocked,
}: ImmersionGateProps) {
  const [escutas, setEscutas] = React.useState(initialPlays);
  const [exigidas, setExigidas] = React.useState(requiredPlays);
  const [aberto, setAberto] = React.useState(unlocked);
  const [blocos, setBlocos] = React.useState<LessonBlock[]>(initialBlocks);
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  /**
   * A resposta do servidor vira o estado da tela, inclusive o número exigido:
   * o valor que veio nas props é só o do primeiro render, e quem decide é a
   * RPC. Manter o número local seria a segunda fonte da verdade de sempre.
   */
  const aplicar = React.useCallback(
    (resposta: RespostaDeEscuta) => {
      if (!resposta.ok) {
        setErro(resposta.error ?? "Não foi possível registrar esta escuta.");
        return;
      }
      setErro(null);
      setEscutas(resposta.escutas);
      setExigidas(resposta.exigidas);
      if (!resposta.desbloqueada) return;
      const abertos = resposta.blocos ?? [];
      setBlocos(abertos);
      setAberto(true);
      onUnlocked?.(abertos);
    },
    [onUnlocked],
  );

  /**
   * Uma escuta completa acabou de acontecer no player.
   *
   * Rede caída não pode trancar o aluno para sempre: o erro aparece, o player
   * continua ali e ele ouve de novo. Repetir depois de uma falha não infla a
   * contagem, porque `count_listen` ignora chamadas dentro da janela da
   * própria faixa — é para isso que `segundos` viaja junto.
   */
  const registrarEscuta = React.useCallback(
    (_contagemLocal: number, segundos: number) => {
      setEnviando(true);
      void contarEscutaAction({ day, key: exposureKey, seconds: segundos })
        .then(aplicar)
        .catch(() =>
          setErro(
            "Sua escuta não chegou ao servidor. Confira a conexão e ouça mais uma vez.",
          ),
        )
        .finally(() => setEnviando(false));
    },
    [day, exposureKey, aplicar],
  );

  /**
   * A saída de quem não pode ouvir, e só dela.
   *
   * A RPC `unlock_exposure` recusa quem não tem `profiles.audio_exempt`, então
   * o botão escondido aqui não é a defesa: é só não oferecer a porta a quem
   * não precisa dela.
   */
  const dispensar = React.useCallback(() => {
    setEnviando(true);
    void dispensarAudioAction({ day, key: exposureKey })
      .then(aplicar)
      .catch(() =>
        setErro("Não foi possível abrir o texto agora. Tente de novo."),
      )
      .finally(() => setEnviando(false));
  }, [day, exposureKey, aplicar]);

  return (
    <div className="space-y-4">
      <AudioPlayer
        text={text}
        srcOverride={audioUrl}
        mode="dialogue"
        label={
          aberto
            ? "Diálogo completo"
            : `Escuta ${Math.min(escutas + 1, exigidas)} de ${exigidas}`
        }
        onPlayCountChange={registrarEscuta}
      />

      {/* Não há caminho de reserva para o texto aqui.
          Havia: quando a lição não trazia blocos travados, o portão abria a
          transcrição crua — e essa transcrição chegava ao navegador junto com
          a página, o que a deixava legível no inspetor antes da primeira
          escuta. Hoje o portão só é montado onde EXISTE bloco travado (dias 1
          e 4 do circuito), e esses blocos vêm pela server action. Sem blocos
          não há portão, e sem portão não há o que abrir. */}
      {aberto ? (
        <div className="animate-in-up space-y-4">{renderBlocks(blocos)}</div>
      ) : (
        <div className="border-border/70 rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">
            O texto aparece depois de {exigidas} escutas
          </p>
          <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-xs leading-relaxed">
            Ouvir antes de ler não é firula: se você lê primeiro, seu cérebro
            cola a pronúncia do português nas letras: e depois é bem mais
            trabalhoso desfazer.
          </p>
          <div className="text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
            {Array.from({ length: exigidas }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "size-2 rounded-full transition-colors",
                  i < escutas ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>

          {erro ? (
            <p className="text-destructive mx-auto mt-3 max-w-md text-xs leading-relaxed">
              {erro}
            </p>
          ) : null}

          {audioExempt ? (
            <button
              type="button"
              onClick={dispensar}
              disabled={enviando}
              className="text-muted-foreground/70 hover:text-foreground mt-4 text-xs underline underline-offset-4 disabled:opacity-60"
            >
              Não consigo ouvir: abrir o texto
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
