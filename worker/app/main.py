import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI

logging.basicConfig(level=logging.INFO)

from app.config import settings
from app.pydub_ffmpeg import ensure_pydub_ffmpeg

ensure_pydub_ffmpeg()  # before consumer → pipeline imports pydub

from app.consumer import start_consumer_thread
logger = logging.getLogger(__name__)


def _ensure_vieneu_import() -> None:
    if settings.tts_provider != "vieneu":
        return
    try:
        import vieneu  # noqa: F401, PLC0415
    except ImportError as exc:
        msg = (
            "Thieu goi Python 'vieneu'. Ban dang chay: "
            f"{sys.executable!r} — can dung worker/.venv (pip install -r requirements.txt "
            "+ --extra-index-url llama-cpp CPU, xem worker/README.md)."
        )
        logger.critical(msg)
        raise RuntimeError(msg) from exc


@asynccontextmanager
async def lifespan(_: FastAPI):
    _ensure_vieneu_import()
    logger.info(
        "TTS provider=%s python=%s vieneu_preset_voice_id=%s",
        settings.tts_provider,
        sys.executable,
        (settings.vieneu_preset_voice_id or "").strip() or "-",
    )
    start_consumer_thread()
    yield


app = FastAPI(title="Story TTS Worker", lifespan=lifespan)


@app.get("/health")
def health():
    vieneu_ok = True
    if settings.tts_provider == "vieneu":
        try:
            import vieneu  # noqa: F401, PLC0415
        except ImportError:
            vieneu_ok = False
    return {
        "status": "ok" if (settings.tts_provider != "vieneu" or vieneu_ok) else "degraded",
        "tts_provider": settings.tts_provider,
        "vieneu_import_ok": vieneu_ok,
        "python": sys.executable,
        "vieneu_preset_voice_id": (settings.vieneu_preset_voice_id or "").strip() or None,
    }
