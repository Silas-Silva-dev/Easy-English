"""
Recebe uma lista de frases em inglês e devolve o mapa {frase: pronúncia}.

Chamado por `scripts/generate-pronunciation.ts`. A divisão é a mesma do
piper_worker: o TypeScript decide O QUE precisa de figuração, o Python só
transforma. O JSON sai em stdout; progresso e avisos vão para stderr, para
não sujar a saída que o Node vai parsear.
"""

import json
import sys
from pathlib import Path

from piper.phonemize_espeak import EspeakPhonemizer

sys.path.insert(0, str(Path(__file__).parent))
from respell import respell  # noqa: E402


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("uso: respell_worker.py <textos.json>")

    texts = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    phonemizer = EspeakPhonemizer()

    unknown: set[str] = set()
    out: dict[str, str] = {}

    for index, text in enumerate(texts, 1):
        out[text] = respell(phonemizer, text, unknown)
        if index % 200 == 0:
            print(f"  {index}/{len(texts)}", file=sys.stderr)

    # Fonema fora da tabela some da grafia sem ninguém perceber lendo — então
    # ele é denunciado alto, com exemplo, em vez de virar defeito silencioso.
    if unknown:
        listed = " ".join(sorted(unknown))
        print(f"\n  AVISO: fonemas sem mapeamento na tabela: {listed}", file=sys.stderr)
        print("  Eles foram OMITIDOS da figuração. Adicione-os em scripts/respell.py.", file=sys.stderr)
        for phoneme in sorted(unknown):
            example = next(
                (t for t in texts if phoneme in respell(phonemizer, t, None)),
                None,
            )
            print(f"    {phoneme}  ex.: {example or '(não localizado)'}", file=sys.stderr)

    print(f"  {len(out)} figurações prontas", file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
