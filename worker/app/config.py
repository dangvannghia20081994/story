from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Luôn trỏ tới worker/.env (cạnh thư mục app/), không phụ thuộc cwd khi chạy uvicorn
_WORKER_ROOT = Path(__file__).resolve().parent.parent
_ENV_PATH = _WORKER_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH) if _ENV_PATH.is_file() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    redis_url: str = "redis://localhost:6379/0"
    queue_name: str = "story:tts:queue"

    backend_url: str = "http://localhost:8000"
    worker_token: str = "change-me"

    storage_public_root: str = "/var/www/html/storage/app/public"

    ffmpeg_path: str = "ffmpeg"

    # --- TTS: ffmpeg (mặc định) hoặc FPT.AI Speech v5 ---
    tts_provider: Literal["ffmpeg", "fpt"] = Field(
        default="ffmpeg",
        description="ffmpeg = file im; fpt = gọi api.fpt.ai (cần FPT_API_KEY)",
    )

    fpt_api_key: str | None = Field(
        default=None,
        description="API key từ console.fpt.ai — header api_key",
    )
    fpt_tts_url: str = "https://api.fpt.ai/hmi/tts/v5"
    fpt_voice: str = Field(
        default="banmai",
        validation_alias=AliasChoices("FPT_TTS_VOICE", "FPT_VOICE"),
    )
    fpt_speed: str = Field(
        default="0",
        validation_alias=AliasChoices("FPT_TTS_SPEED", "FPT_SPEED"),
    )
    fpt_format: str = Field(
        default="mp3",
        validation_alias=AliasChoices("FPT_TTS_FORMAT", "FPT_FORMAT"),
    )
    fpt_poll_timeout_sec: float = 120.0
    fpt_poll_interval_sec: float = 2.0


settings = Settings()
