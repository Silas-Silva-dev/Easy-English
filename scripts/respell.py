"""
Pronúncia figurada: inglês falado, escrito com as letras do português.

    "Nice to meet you."  ->  "náis ta mît iú"

===========================================================================
POR QUE NÃO SE DERIVA DA GRAFIA
===========================================================================
Tentar adivinhar o som a partir de como a palavra é ESCRITA em inglês não
funciona: "though", "through", "tough" e "thought" começam igual e soam
diferente. Por isso aqui a fonte é o espeak-ng (que já vem instalado com o
Piper), que devolve os fonemas de verdade. Só depois esses fonemas viram
letras do português.

===========================================================================
AS CONVENÇÕES, E POR QUE CADA UMA
===========================================================================
- Acento agudo/circunflexo marca a SÍLABA TÔNICA. Vogal átona sai sem acento.
  Assim "náis ta mît iú" já diz ao aluno onde bater a força, que é metade do
  que faz uma frase soar inglesa.

- Sons que o português não tem ganham dígrafo e ficam explicados na legenda:
  "th" (think), "dh" (this), "z" com zumbido, "r" retroflexo, "w".
  Fingir que "th" é "f" ou "t" ensina o erro em vez de corrigir.

- Vogal reduzida (schwa) vira "a", não a letra escrita. "to" no meio da frase
  é "ta", não "tu" — é assim que sai na boca do nativo, e treinar o contrário
  é treinar o sotaque de livro que o curso inteiro tenta evitar.

- Consoante final fica seca: "mît", nunca "mîtchi". Vogal de apoio no fim de
  palavra é o erro mais audível do brasileiro, então a grafia não pode sugerir.
"""

import re
import unicodedata

# ---------------------------------------------------------------------------
# Tabela IPA -> português.
#
# Vogais têm duas formas: (tônica, átona). Consoantes têm uma só.
# A ordem importa na hora de casar: sequências longas antes das curtas.
# ---------------------------------------------------------------------------

VOWELS: dict[str, tuple[str, str]] = {
    # ditongos primeiro — senão "aɪ" casaria como "a" + "ɪ"
    "aɪ": ("ái", "ai"),
    "aʊ": ("áu", "au"),
    "ɔɪ": ("ói", "oi"),
    "eɪ": ("êi", "ei"),
    "oʊ": ("ôu", "ou"),
    "əʊ": ("ôu", "ou"),
    "ɪə": ("ía", "ia"),
    "eə": ("éa", "ea"),
    "ʊə": ("úa", "ua"),
    "ɛə": ("éa", "ea"),
    # vogais longas
    "iː": ("î", "i"),
    "uː": ("û", "u"),
    "ɑː": ("á", "a"),
    "ɔː": ("ó", "o"),
    "ɜː": ("âr", "ar"),
    "ɚ": ("âr", "ar"),
    "ɝ": ("âr", "ar"),
    # vogais curtas
    "ɪ": ("í", "i"),
    "ʊ": ("ú", "u"),
    "ɛ": ("é", "e"),
    "æ": ("é", "e"),
    "ʌ": ("â", "a"),
    "ɒ": ("ó", "o"),
    "ɔ": ("ó", "o"),
    "ɑ": ("á", "a"),
    "ə": ("a", "a"),
    "ɐ": ("a", "a"),
    # Vogal reduzida entre "i" e schwa — o espeak usa em "roses", "wanted".
    # Soa como um "i" fraquinho, e é assim que o brasileiro consegue produzir.
    "ᵻ": ("í", "i"),
    "a": ("á", "a"),
    "e": ("ê", "e"),
    "i": ("í", "i"),
    "o": ("ô", "o"),
    "u": ("ú", "u"),
}

CONSONANTS: dict[str, str] = {
    # africadas antes das simples
    "tʃ": "tch",
    "dʒ": "dj",
    "θ": "th",
    "ð": "dh",
    "ʃ": "sh",
    "ʒ": "j",
    "ŋ": "ng",
    "ɹ": "r",
    "ɻ": "r",
    # O T batido do americano ("water", "it is"). É idêntico ao nosso "r" de
    # "caro", então é o único som inglês que o brasileiro já sabe fazer — e
    # deixá-lo cair seria perder a marca mais audível do sotaque americano.
    "ɾ": "r",
    "ɫ": "l",
    "ʔ": "",
    "p": "p",
    "b": "b",
    "t": "t",
    "d": "d",
    "k": "k",
    "ɡ": "g",
    "g": "g",
    "f": "f",
    "v": "v",
    "s": "s",
    "z": "z",
    "h": "h",
    "m": "m",
    "n": "n",
    "l": "l",
    "r": "r",
    "j": "i",
    "w": "u",
    "x": "h",
}

# Casar sempre a sequência mais longa primeiro.
KEYS = sorted(set(VOWELS) | set(CONSONANTS), key=len, reverse=True)

STRESS_MARKS = {"ˈ", "ˌ"}
# Marcas do espeak que não viram letra: ligadura, sílaba, comprimento solto.
IGNORED = {"ˑ", "‿", "|", "ʲ", "̩", "̃", "ː"}

KEEP_PUNCT = set(".,!?;:")


def respell_ipa(ipa: str, unknown: set[str] | None = None) -> str:
    """
    Converte uma string de IPA do espeak em pronúncia figurada.

    Fonema fora da tabela vai para `unknown` em vez de sumir calado — som que
    desaparece da grafia é o pior defeito possível aqui, porque ninguém percebe
    lendo: a frase continua parecendo certa, só que sem uma consoante.
    """
    out: list[str] = []
    stressed = False
    i = 0

    while i < len(ipa):
        char = ipa[i]

        if char in STRESS_MARKS:
            # A marca vem ANTES da sílaba: a próxima vogal é que leva o acento.
            stressed = char == "ˈ"
            i += 1
            continue

        if char == " ":
            out.append(" ")
            stressed = False
            i += 1
            continue

        if char in KEEP_PUNCT:
            out.append(char)
            stressed = False
            i += 1
            continue

        if char in IGNORED:
            i += 1
            continue

        for key in KEYS:
            if ipa.startswith(key, i):
                if key in VOWELS:
                    out.append(VOWELS[key][0 if stressed else 1])
                    stressed = False
                else:
                    out.append(CONSONANTS[key])
                i += len(key)
                break
        else:
            if unknown is not None:
                unknown.add(char)
            i += 1

    text = "".join(out)
    # "ɚ" já carrega o erre; o "ɹ" de ligação que o espeak emite em seguida
    # dobraria a letra ("for a" viraria "farra").
    text = re.sub(r"rr+", "r", text)
    # O espeak solta um "h" de sopro no fim de interjeição ("yeah" -> jˈɛh).
    # Em português esse h no fim não se lê e só confunde.
    text = re.sub(r"([aeiouáéíóúâêôãõ])h\b", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([.,!?;:])", r"\1", text)
    return text


def _flatten(phonemes) -> str:
    """O espeak devolve lista de sentenças, cada uma lista de caracteres."""
    if isinstance(phonemes, str):
        return phonemes
    parts = []
    for sentence in phonemes:
        parts.append("".join(sentence) if not isinstance(sentence, str) else sentence)
    return " ".join(parts)


def respell(phonemizer, text: str, unknown: set[str] | None = None) -> str:
    """Texto em inglês -> pronúncia figurada, passando pelo espeak."""
    clean = unicodedata.normalize("NFC", text).strip()
    if not clean:
        return ""
    ipa = _flatten(phonemizer.phonemize("en-us", clean))
    return respell_ipa(ipa, unknown)


if __name__ == "__main__":
    from piper.phonemize_espeak import EspeakPhonemizer

    p = EspeakPhonemizer()
    samples = [
        "Nice to meet you.",
        "How are you?",
        "Hi! I'm Sarah.",
        "Oh, hi! I'm Ana. Nice to meet you.",
        "I'm good, thanks. And you?",
        "Yeah, it is.",
        "Sorry, what's your name again?",
        "I'd like a sandwich.",
        "Can I have a coffee, please?",
        "I'm gonna need all the caffeine I can get today.",
        "Let's catch up soon!",
        "I've been learning English for a year now.",
        "Think about the weather.",
    ]
    for s in samples:
        print(f"{s}\n   {respell(p, s)}\n")
