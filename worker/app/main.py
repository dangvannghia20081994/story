import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

logging.basicConfig(level=logging.INFO)

from app.config import settings
from app.pydub_ffmpeg import ensure_pydub_ffmpeg
from app.consumer import start_consumer_thread

ensure_pydub_ffmpeg()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info(
        "TTS provider=%s fpt_api_key_configured=%s",
        settings.tts_provider,
        bool(settings.fpt_api_key and settings.fpt_api_key.strip()),
    )
    start_consumer_thread()
    yield


app = FastAPI(title="Story TTS Worker", lifespan=lifespan)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "tts_provider": settings.tts_provider,
        "fpt_api_key_configured": bool(settings.fpt_api_key and settings.fpt_api_key.strip()),
    }
