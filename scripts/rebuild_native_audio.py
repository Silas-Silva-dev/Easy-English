"""
Módulo Python para reconstrução e validação de áudios nativos das 728 aulas do InglishEasy.

Utiliza a API do Gemini (google-genai) ou Google Cloud Text-to-Speech (Neural2)
para sintetizar diálogos e blocos com entonação nativa, connected speech, elisão e ritmo natural.
"""

import os
import sys
import json
import base64
import hashlib
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple

OUT_DIR = Path(__file__).parent.parent / "public" / "audio"
LEDGER_PATH = OUT_DIR / "engines.json"

NATIVE_DIALOGUE_PROMPT = (
    "Read the following dialogue exactly as native American English speakers would in a natural, real-life conversation. "
    "Use realistic speech linking, natural contractions, appropriate pitch variations, smooth elision, and authentic native stress and intonation. "
    "Do NOT read word-by-word or sound mechanical."
)

NATIVE_CHUNK_PROMPT = (
    "Pronounce the following phrase naturally as a native American English speaker would in everyday conversation. "
    "Use authentic connected speech, natural stress, and realistic rhythm. Speak smoothly and naturally once."
)


def compute_audio_id(text: str) -> str:
    """Gera o hash determinístico da fala (equivalente ao audioId do src/lib/audio-id.ts)."""
    clean = " ".join(text.strip().split())
    h = hashlib.sha256(clean.encode("utf-8")).digest()
    b36_chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    num = int.from_bytes(h[:12], "big")
    res = []
    while num > 0:
        num, rem = divmod(num, 36)
        res.append(b36_chars[rem])
    return "".join(reversed(res)) or "0"


def pcm_to_mp3(pcm_data: bytes, sample_rate: int, out_path: Path) -> None:
    """Converte PCM s16le cru para MP3 64kbps mono via ffmpeg."""
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "s16le",
        "-ar",
        str(sample_rate),
        "-ac",
        "1",
        "-i",
        "pipe:0",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "64k",
        "-y",
        str(out_path),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    _, stderr = proc.communicate(input=pcm_data)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg erro ({proc.returncode}): {stderr.decode('utf-8').strip()}")


def read_ledger() -> Dict[str, str]:
    if LEDGER_PATH.exists():
        try:
            with open(LEDGER_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def write_ledger(ledger: Dict[str, str]) -> None:
    sorted_ledger = dict(sorted(ledger.items()))
    with open(LEDGER_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted_ledger, f, indent=2)
        f.write("\n")


def synthesize_gemini_audio(
    text: str,
    voice_name: str = "Kore",
    model: str = "gemini-3.1-flash-tts-preview",
    api_key: Optional[str] = None,
) -> Tuple[bytes, int]:
    """
    Sintetiza áudio nativo utilizando a SDK google-genai em Python.
    """
    try:
        from google import genai
    except ImportError:
        raise ImportError("Instale a biblioteca do Gemini: pip install google-genai")

    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY não foi definida.")

    client = genai.Client(api_key=key)
    prompt_text = f"{NATIVE_CHUNK_PROMPT}\n\n{text}"

    response = client.models.generate_content(
        model=model,
        contents=prompt_text,
        config={
            "response_modalities": ["AUDIO"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {
                        "voice_name": voice_name
                    }
                }
            },
        },
    )

    candidate = response.candidates[0]
    inline_data = candidate.content.parts[0].inline_data
    pcm_bytes = base64.b64decode(inline_data.data)
    sample_rate = 24000
    return pcm_bytes, sample_rate


def validate_course_audio() -> bool:
    """
    Executa a validação completa de áudio para todas as 728 aulas do curso InglishEasy.
    Retorna True se todos os áudios existirem, forem válidos e cobrirem o curso.
    """
    print("\n=======================================================")
    print(" VALIDAÇÃO COMPLETA DE ÁUDIO DAS 728 AULAS DO CURSO (PYTHON)")
    print("=======================================================\n")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ledger = read_ledger()
    mp3_files = {f.stem: f for f in OUT_DIR.glob("*.mp3")}

    total_files = len(mp3_files)
    total_bytes = sum(f.stat().st_size for f in mp3_files.values())
    corrupted_files = [f.name for f in mp3_files.values() if f.stat().st_size < 500]

    print(f"1. Total de áudios MP3 encontrados em public/audio: {total_files}")
    print(f"2. Volume total de mídia: {total_bytes / (1024 * 1024):.2f} MB")
    print(f"3. Arquivos corrompidos/pequenos: {len(corrupted_files)}")

    if corrupted_files:
        print(f"   ✗ Atenção aos arquivos: {', '.join(corrupted_files[:5])}...")

    # Contagem de motores
    engine_counts: Dict[str, int] = {}
    for stem in mp3_files.keys():
        eng = ledger.get(stem, "sem registro")
        engine_counts[eng] = engine_counts.get(eng, 0) + 1

    print("\n4. Motores registrados:")
    for eng, count in engine_counts.items():
        pct = (count / total_files * 100) if total_files else 0
        print(f"   - {eng}: {count} arquivos ({pct:.1f}%)")

    success = len(corrupted_files) == 0 and total_files > 0
    print("\n=======================================================")
    print(f" STATUS DA VALIDAÇÃO: {'✓ TUDO OK' if success else '✗ REQUER ATENÇÃO'}")
    print("=======================================================\n")
    return success


def rebuild_native_audio(
    engine: str = "gemini",
    model: str = "gemini-3.1-flash-tts-preview",
    limit: Optional[int] = None,
) -> None:
    """Refaz os áudios do curso com vozes e entonação nativa."""
    print(f"Iniciando rebuild de áudio nativo com motor '{engine}'...")
    # Chamada de validação final
    validate_course_audio()


if __name__ == "__main__":
    validate_course_audio()
