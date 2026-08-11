/**
 * A contração, que é o que separa inglês escrito de inglês falado.
 *
 * ===========================================================================
 * POR QUE O CURSO EXIGE
 * ===========================================================================
 * O brasileiro aprende "I am" na escola e fala "I am" a vida inteira. Nativo
 * não fala assim. A forma cheia, na conversa, soa enfática — "I AM going" é
 * uma correção, não uma informação. Um curso 100% focado em conversação que
 * ensina a forma cheia ensina o aluno a soar estranho com gramática correta.
 *
 * ===========================================================================
 * A EXCEÇÃO, QUE CUSTOU TRÊS CIRCUITOS REPROVADOS
 * ===========================================================================
 * No fim da oração o auxiliar NÃO CONTRAI. "Yes, I am." está certo e
 * "Yes, I'm." é agramatical — o inglês não aceita forma fraca em posição
 * tônica final. Vale para toda resposta curta: "Yes, he is.", "Yes, they
 * are.", "I think it is.".
 *
 * Por isso o lookahead: só casa quando o auxiliar tem continuação. Antes de
 * ponto, vírgula, interrogação, exclamação ou fim de texto, ele fica.
 *
 * ===========================================================================
 * POR QUE CONSERTAR EM VEZ DE REPROVAR
 * ===========================================================================
 * Reprovar era o que este código fazia, e custou caro: uma única "He is" no
 * meio de vinte e oito falas jogava fora o diálogo inteiro e gastava mais uma
 * chamada do modelo. Três circuitos morreram assim numa rodada.
 *
 * A observação que resolve: se a expressão CASOU, então a posição não é final
 * — e fora da posição final a contração é a forma certa, sempre, sem depender
 * de contexto. Ou seja, o conserto é determinístico e preserva o sentido. Não
 * é o modelo adivinhando de novo: é ortografia.
 *
 * O que continua reprovando é o que NÃO dá para consertar por regra — frase
 * longa demais, bloco repetido, recombinação que não contém o bloco.
 */

/** As formas cheias que a fala contrai, e no que elas viram. */
const CONTRACOES: Record<string, string> = {
  "i am": "I'm",
  "it is": "it's",
  "that is": "that's",
  "there is": "there's",
  "he is": "he's",
  "she is": "she's",
  "we are": "we're",
  "they are": "they're",
  "you are": "you're",
  "do not": "don't",
  "does not": "doesn't",
  "did not": "didn't",
  "is not": "isn't",
  "are not": "aren't",
  "was not": "wasn't",
  "were not": "weren't",
  cannot: "can't",
  "will not": "won't",
  "would not": "wouldn't",
  "should not": "shouldn't",
  "have not": "haven't",
  "has not": "hasn't",
};

const ALTERNATIVAS = Object.keys(CONTRACOES).join("|");

/** Casa a forma cheia SÓ onde ela tem continuação — nunca no fim da oração. */
const PADRAO = new RegExp(`\\b(${ALTERNATIVAS})\\b(?!\\s*[.,!?]|$)`, "gi");

/** A forma cheia encontrada, ou `null` se o texto já está falado. */
export function faltaContracao(en: string): string | null {
  PADRAO.lastIndex = 0;
  return PADRAO.exec(en)?.[0] ?? null;
}

/**
 * Contrai o que precisa ser contraído, preservando a maiúscula de origem.
 *
 * "He is in the break room." vira "He's in the break room." — e "Yes, he is."
 * fica exatamente como está, porque ali o padrão não casa.
 */
export function contrair(en: string): string {
  return en.replace(PADRAO, (achado) => {
    const contraida = CONTRACOES[achado.toLowerCase()];
    if (!contraida) return achado;
    // "i am" já devolve "I'm" maiúsculo; para o resto, a maiúscula vem de quem
    // escreveu — início de frase mantém, meio de frase mantém minúsculo.
    const comecaMaiuscula = achado[0] === achado[0].toUpperCase();
    return comecaMaiuscula ? contraida[0].toUpperCase() + contraida.slice(1) : contraida;
  });
}
