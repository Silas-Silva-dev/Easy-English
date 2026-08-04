/**
 * Síntese de fala local, no próprio navegador.
 *
 * ===========================================================================
 * POR QUE NÃO É UMA API
 * ===========================================================================
 * O áudio do curso não é gerado por serviço externo. Ele é sintetizado pela
 * Web Speech API, que já existe em todo navegador moderno e usa as vozes
 * instaladas no sistema operacional. Isso significa:
 *
 *   - Zero custo e zero cota. Um aluno pode ouvir o mesmo bloco 200 vezes.
 *   - Zero latência de rede. O play é instantâneo.
 *   - Funciona sem conexão depois que a página carregou.
 *   - Nenhum áudio precisa ser armazenado, versionado ou re-gerado.
 *
 * ===========================================================================
 * O QUE ISSO NÃO É: e é importante ser claro
 * ===========================================================================
 * Não é gravação de falante nativo humano. É voz sintética do sistema, e a
 * qualidade varia conforme o dispositivo: no Windows e no macOS as vozes en-US
 * são boas; em alguns Androids antigos são mecânicas.
 *
 * Para o que o curso usa: reconhecer o bloco, copiar o ritmo, fazer shadowing
 *: a voz sintética serve bem. Para ouvido treinado em fala natural conectada,
 * o dia 8 de cada circuito manda o aluno para material humano de verdade, que
 * é o lugar certo para isso.
 */

export interface SpeechVoiceInfo {
  name: string;
  lang: string;
}

export interface SpeakLine {
  speaker?: string;
  text: string;
}

export interface SpeakOptions {
  rate?: number;
  /**
   * Começar desta fala em vez da primeira.
   *
   * A síntese do navegador não tem linha do tempo para buscar um segundo
   * exato, então a fala é a menor unidade que dá para retomar. É o que
   * sustenta o "voltar um trecho" e a troca de velocidade sem perder o lugar.
   */
  startAt?: number;
  /** Chamado quando cada fala começa: usado para destacar a linha atual. */
  onLine?: (index: number, total: number) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Vozes já conhecidas, guardadas para o play poder sair SÍNCRONO.
 *
 * Isto não é micro-otimização, é o que faz o áudio existir no Safari e no
 * Chrome do celular: lá o `speak()` só produz som se for chamado dentro do
 * próprio handler do toque. Qualquer `await` antes dele encerra a "ativação do
 * usuário", e a fala é descartada em silêncio: sem som e sem evento de erro.
 * Por isso `speakLines` consulta este cache em vez de esperar por promessa.
 */
let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
  return cachedVoices;
}

/**
 * Aquece o cache de vozes na montagem do player, bem antes do clique.
 * Sem isso o primeiro play cairia no caminho assíncrono justamente na hora
 * em que o gesto do usuário precisa ser preservado.
 */
export function primeVoices(): void {
  if (!isSpeechSupported()) return;
  if (refreshVoices().length) return;
  window.speechSynthesis.addEventListener("voiceschanged", () => void refreshVoices(), {
    once: true,
  });
}

/**
 * As vozes chegam de forma assíncrona no Chrome: a primeira chamada a
 * getVoices() costuma vir vazia e só depois o evento `voiceschanged` dispara.
 * Sem esperar por ele, o primeiro play sai com a voz padrão do sistema: que
 * pode ser em português, lendo inglês com sotaque brasileiro.
 */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSupported()) return Promise.resolve([]);

  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener("voiceschanged", finish);
    window.setTimeout(finish, timeoutMs);
  });
}

/**
 * Ordena as vozes inglesas por qualidade provável.
 *
 * Preferimos en-US (o curso ensina inglês americano), vozes marcadas como
 * locais (as remotas do Chrome dependem de rede) e nomes conhecidos por
 * soarem naturais. Qualquer voz en-* serve como último recurso.
 */
const PREFERRED = [
  "Google US English",
  "Samantha",
  "Microsoft Aria",
  "Microsoft Jenny",
  "Microsoft Zira",
  "Microsoft Guy",
  "Microsoft David",
  "Alex",
  "Daniel",
];

function scoreVoice(voice: SpeechSynthesisVoice): number {
  let score = 0;
  if (voice.lang.toLowerCase().startsWith("en-us")) score += 100;
  else if (voice.lang.toLowerCase().startsWith("en")) score += 60;
  else return -1;

  const named = PREFERRED.findIndex((p) => voice.name.includes(p));
  if (named !== -1) score += 40 - named * 2;
  if (voice.localService) score += 10;

  return score;
}

export function englishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices
    .map((v) => ({ v, s: scoreVoice(v) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v);
}

/**
 * Duas vozes distintas para diálogo.
 *
 * Isso não é enfeite: quando as duas pessoas do diálogo têm a mesma voz, o
 * aluno não separa os turnos e a conversa vira um monólogo. Se o sistema só
 * tiver uma voz inglesa, variamos o pitch para pelo menos diferenciar.
 */
export function pickDialogueVoices(voices: SpeechSynthesisVoice[]) {
  const english = englishVoices(voices);
  if (!english.length) return { a: null, b: null, samePitchFallback: true };
  if (english.length === 1) return { a: english[0], b: english[0], samePitchFallback: true };
  return { a: english[0], b: english[1], samePitchFallback: false };
}

/** Converte o roteiro salvo no banco ("SARAH: Hi / ANA: Hello") em falas. */
export function parseScript(script: string): SpeakLine[] {
  return script
    .split(/\s*\/\s*|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = /^([A-Za-zÀ-ÿ0-9 .'-]{1,24}):\s*(.+)$/.exec(raw);
      return match
        ? { speaker: match[1].trim(), text: match[2].trim() }
        : { text: raw };
    });
}

let activeToken = 0;

/**
 * Referências vivas das utterances em curso.
 *
 * Parece inútil e não é: o Chrome e o Safari coletam a utterance assim que ela
 * perde a última referência, e uma utterance coletada para de falar (ou nem
 * começa) sem disparar `onend` nem `onerror`. Guardá-las aqui até o fim da
 * sequência é o remédio conhecido para a fala que some no meio.
 */
let pending: SpeechSynthesisUtterance[] = [];

/**
 * Quanto esperamos a primeira fala começar antes de admitir que não vem som.
 * Sem isto, todo modo de falha silenciosa vira "apertei o play e não aconteceu
 * nada": sem mensagem, sem pista, sem o que reportar.
 */
const START_TIMEOUT_MS = 4000;

export function cancelSpeech() {
  activeToken++;
  pending = [];
  if (!isSpeechSupported()) return;
  // Só cancela se houver algo para cancelar: `cancel()` seguido de `speak()`
  // com o sintetizador ocioso é uma corrida conhecida do Chrome que engole a
  // primeira utterance: exatamente o play inicial de cada lição.
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Fala uma sequência de linhas, alternando as vozes por interlocutor.
 *
 * Encadeamos manualmente em vez de enfileirar tudo de uma vez porque o Chrome
 * perde utterances de uma fila longa, e porque só assim conseguimos saber em
 * qual linha estamos para destacá-la na tela.
 */
export function speakLines(lines: SpeakLine[], options: SpeakOptions = {}) {
  if (!isSpeechSupported()) {
    options.onError?.("Este navegador não sintetiza fala. Tente pelo Chrome, Edge ou Safari.");
    return;
  }
  // Devolve o controle mesmo sem nada a falar: sem o onEnd, o botão ficaria
  // travado em "tocando" para sempre.
  if (!lines.length) {
    options.onEnd?.();
    return;
  }

  cancelSpeech();
  const token = activeToken;

  // Caminho normal: as vozes já estão em cache, então falamos AGORA, ainda
  // dentro do gesto do usuário. Ver o comentário de `cachedVoices`.
  const ready = refreshVoices();
  if (ready.length) {
    speakSequence(lines, ready, token, options);
    return;
  }

  // Primeiro play numa aba onde as vozes ainda não chegaram. Aqui não há
  // escolha senão esperar: e no iOS este play pode sair mudo. O aquecimento
  // feito por `primeVoices()` na montagem existe para este caso ser raro.
  void loadVoices().then((voices) => {
    if (token !== activeToken) return;
    speakSequence(lines, voices.length ? voices : refreshVoices(), token, options);
  });
}

function speakSequence(
  lines: SpeakLine[],
  voices: SpeechSynthesisVoice[],
  token: number,
  options: SpeakOptions,
) {
  const { a, b, samePitchFallback } = pickDialogueVoices(voices);
  if (!a) {
    options.onError?.(
      "Nenhuma voz em inglês instalada neste dispositivo. Adicione uma nas configurações de idioma do sistema.",
    );
    return;
  }

  // Mapeia cada interlocutor para uma das duas vozes, na ordem em que aparecem.
  const speakers = [...new Set(lines.map((l) => l.speaker).filter(Boolean))] as string[];
  const rate = options.rate ?? 1;
  let watchdog = 0;

  const speakAt = (index: number) => {
    if (token !== activeToken) return;
    if (index >= lines.length) {
      pending = [];
      options.onEnd?.();
      return;
    }

    const line = lines[index];
    const isSecond = line.speaker ? speakers.indexOf(line.speaker) % 2 === 1 : false;

    const utterance = new SpeechSynthesisUtterance(line.text);
    utterance.voice = isSecond ? (b ?? a) : a;
    utterance.lang = utterance.voice?.lang ?? "en-US";
    utterance.rate = rate;
    // Sem voz distinta disponível, o pitch é o que separa os interlocutores.
    utterance.pitch = samePitchFallback && isSecond ? 0.8 : 1;

    utterance.onstart = () => {
      window.clearTimeout(watchdog);
      if (token === activeToken) options.onLine?.(index, lines.length);
    };
    utterance.onend = () => {
      window.clearTimeout(watchdog);
      speakAt(index + 1);
    };
    utterance.onerror = (event) => {
      window.clearTimeout(watchdog);
      // "interrupted" e "canceled" são esperados quando o aluno aperta pausa.
      if (event.error === "interrupted" || event.error === "canceled") return;
      options.onError?.(`Falha ao sintetizar a fala (${event.error}).`);
    };

    // Segura a referência até a sequência acabar: ver `pending`.
    pending.push(utterance);

    // O sintetizador pode estar pausado: acontece no Chrome depois de a aba ir
    // para segundo plano, e o `speak()` então só enfileira, sem tocar.
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);

    // Rede de segurança só na primeira fala: é onde mora o "não saiu som".
    if (index === 0) {
      watchdog = window.setTimeout(() => {
        if (token !== activeToken) return;
        window.speechSynthesis.cancel();
        options.onError?.(
          "O navegador aceitou a fala mas não emitiu som. Confira o volume e o mudo do sistema. " +
            "No iPhone e no iPad, a chavinha lateral de silencioso também corta a voz sintética.",
        );
      }, START_TIMEOUT_MS);
    }
  };

  // Retoma da fala pedida, limitada ao que existe.
  speakAt(Math.min(Math.max(options.startAt ?? 0, 0), lines.length - 1));
}
