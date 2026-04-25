import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.consumer import start_consumer_thread

logging.basicConfig(level=logging.INFO)
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
