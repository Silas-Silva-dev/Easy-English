"""
Sintetiza um lote de áudios com o Piper — TTS neural local, sem chave e sem cota.

Não é chamado à mão: `scripts/generate-audio.ts --engine piper` monta a lista de
trabalhos e invoca este arquivo. A divisão é essa de propósito — toda a decisão
(quem fala, com qual voz, qual o nome do arquivo) fica no TypeScript, junto com
a do motor do Gemini, e aqui só se transforma texto em som.

===========================================================================
POR QUE UM PROCESSO SÓ PARA O LOTE INTEIRO
===========================================================================
Carregar um modelo do Piper custa ~4s; sintetizar uma fala custa ~0,23s. Chamar
o executável uma vez por fala gastaria 96% do tempo carregando modelo — o lote
completo levaria uma noite. Carregando cada voz uma vez e reaproveitando, o
mesmo trabalho leva minutos.

Entrada: JSON com [{ id, lines: [{ voice, text }] }]
Saída:   <out_dir>/<id>.mp3, e uma linha "OK <id> <segundos>" no stdout por
         arquivo pronto (o TypeScript usa isso para a barra de progresso).
"""

import io
import json
import subprocess
import sys
import wave
from pathlib import Path

from piper import PiperVoice

# Silêncio entre falas emendadas. Sem isso a conversa atropela e o aluno não
# percebe a troca de turno — que é metade do que ele precisa ouvir.
GAP_MS = 400


def load_voices(jobs, voices_dir: Path):
    """Carrega só as vozes que este lote realmente usa."""
    wanted = {line["voice"] for job in jobs for line in job["lines"]}
    loaded = {}
    for name in sorted(wanted):
        path = voices_dir / f"{name}.onnx"
        if not path.exists():
            sys.exit(f"FATAL voz ausente: {path}")
        loaded[name] = PiperVoice.load(str(path))
    return loaded


def synth(voice, text: str):
    """Devolve (pcm_bytes, sample_rate) de uma fala."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        voice.synthesize_wav(text, handle)
    buffer.seek(0)
    with wave.open(buffer, "rb") as handle:
        return handle.readframes(handle.getnframes()), handle.getframerate()


def to_mp3(pcm: bytes, rate: int, out_path: Path) -> None:
    """PCM cru -> MP3 mono 64 kbps. Mesmo destino do motor do Gemini."""
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "s16le", "-ar", str(rate), "-ac", "1",
            "-i", "pipe:0",
            "-codec:a", "libmp3lame", "-b:a", "64k",
            "-y", str(out_path),
        ],
        input=pcm,
        check=True,
    )


def main() -> None:
    if len(sys.argv) != 4:
        sys.exit("uso: piper_worker.py <jobs.json> <out_dir> <voices_dir>")

    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out_dir = Path(sys.argv[2])
    voices_dir = Path(sys.argv[3])
    out_dir.mkdir(parents=True, exist_ok=True)

    if not jobs:
        return

    voices = load_voices(jobs, voices_dir)
    print(f"READY {len(voices)}", flush=True)

    for job in jobs:
        try:
            chunks, rate = [], 22050
            for index, line in enumerate(job["lines"]):
                text = line["text"].strip()
                if not text:
                    continue
                pcm, rate = synth(voices[line["voice"]], text)
                if index:
                    # 16 bits mono: 2 bytes por amostra.
                    chunks.append(b"\x00" * int(rate * 2 * GAP_MS / 1000))
                chunks.append(pcm)

            if not chunks:
                print(f"FAIL {job['id']} sem texto para falar", flush=True)
                continue

            audio = b"".join(chunks)
            to_mp3(audio, rate, out_dir / f"{job['id']}.mp3")
            print(f"OK {job['id']} {len(audio) / (rate * 2):.1f}", flush=True)

        except Exception as error:  # noqa: BLE001 — um item ruim não derruba o lote
            print(f"FAIL {job['id']} {error}", flush=True)


if __name__ == "__main__":
    main()
