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
 * O QUE ISSO NÃO É — e é importante ser claro
 * ===========================================================================
 * Não é gravação de falante nativo humano. É voz sintética do sistema, e a
 * qualidade varia conforme o dispositivo: no Windows e no macOS as vozes en-US
 * são boas; em alguns Androids antigos são mecânicas.
 *
 * Para o que o curso usa — reconhecer o bloco, copiar o ritmo, fazer shadowing
 * — a voz sintética serve bem. Para ouvido treinado em fala natural conectada,
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
  /** Chamado quando cada fala começa — usado para destacar a linha atual. */
  onLine?: (index: number, total: number) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * As vozes chegam de forma assíncrona no Chrome: a primeira chamada a
 * getVoices() costuma vir vazia e só depois o evento `voiceschanged` dispara.
 * Sem esperar por ele, o primeiro play sai com a voz padrão do sistema — que
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

export function cancelSpeech() {
  activeToken++;
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}

/**
 * Fala uma sequência de linhas, alternando as vozes por interlocutor.
 *
 * Encadeamos manualmente em vez de enfileirar tudo de uma vez porque o Chrome
 * perde utterances de uma fila longa, e porque só assim conseguimos saber em
 * qual linha estamos para destacá-la na tela.
 */
export async function speakLines(lines: SpeakLine[], options: SpeakOptions = {}) {
  if (!isSpeechSupported()) {
    options.onError?.("Este navegador não sintetiza fala. Tente pelo Chrome, Edge ou Safari.");
    return;
  }
  if (!lines.length) return;

  cancelSpeech();
  const token = activeToken;

  const voices = await loadVoices();
  if (token !== activeToken) return;

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

  const speakAt = (index: number) => {
    if (token !== activeToken) return;
    if (index >= lines.length) {
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
      if (token === activeToken) options.onLine?.(index, lines.length);
    };
    utterance.onend = () => speakAt(index + 1);
    utterance.onerror = (event) => {
      // "interrupted" e "canceled" são esperados quando o aluno aperta pausa.
      if (event.error === "interrupted" || event.error === "canceled") return;
      options.onError?.(`Falha ao sintetizar a fala (${event.error}).`);
    };

    window.speechSynthesis.speak(utterance);
  };

  speakAt(0);
}
