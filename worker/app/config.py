from pathlib import Path
from typing import Literal

from pydantic import Field
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

    ffmpeg_path: str = "ffmpeg"

    # --- TTS: ffmpeg (im lặng, dev) hoặc VieNeu (vieneu) ---
    tts_provider: Literal["ffmpeg", "vieneu"] = Field(
        default="vieneu",
        description="ffmpeg = im lặng; vieneu = VieNeu-TTS on-device (tiếng Việt)",
    )

    # Mã 1–4 (khớp CMS) hoặc tên preset đầy đủ SDK; None = giọng mặc định SDK.
    vieneu_preset_voice_id: str | None = Field(
        default=None,
        description="Ghi đè voice_id segment đầu trong queue nếu set (vd. 1–4).",
    )

    # VieNeu / huggingface_hub đọc biến môi trường HF_TOKEN; đặt trong worker/.env để áp dụng.
    hf_token: str | None = Field(
        default=None,
        description="Token Hugging Face (Read) — tải model VieNeu, giảm rate limit.",
    )


settings = Settings()
