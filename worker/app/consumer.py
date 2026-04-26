import logging
import threading
import time

import redis

from app.config import settings
from app.pipeline import handle_job

logger = logging.getLogger(__name__)


def _loop() -> None:
    client = redis.Redis.from_url(settings.redis_url, decode_responses=False)
    logger.info("Worker consumer listening on %s", settings.queue_name)
    while True:
        try:
            item = client.brpop(settings.queue_name, timeout=5)
            if item is None:
                continue
            _, payload = item
            logger.info(
                "Redis BRPOP: queue=%s payload_bytes=%d",
                settings.queue_name,
                len(payload),
            )
            handle_job(payload)
        except redis.RedisError:
            logger.exception("Redis error; retrying")
            time.sleep(2)


def start_consumer_thread() -> threading.Thread:
    thread = threading.Thread(target=_loop, name="tts-consumer", daemon=True)
    thread.start()
    return thread
