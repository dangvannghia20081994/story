# Worker TTS: gọi Revid TTS API (HTTPS) + ffmpeg ghép chunks MP3.
FROM python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY worker_redis.py ./

ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "worker_redis.py"]
