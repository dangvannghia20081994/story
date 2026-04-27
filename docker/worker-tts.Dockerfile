# VieNeu-TTS: eSpeak NG + toolchain build (sea-g2p không có wheel cp312 trên linux/amd64; llama-cpp có thể compile nếu không khớp wheel).
FROM python:3.12-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        espeak-ng \
        ca-certificates \
        build-essential \
        cmake \
        ninja-build \
        git \
        pkg-config \
        curl \
    && rm -rf /var/lib/apt/lists/*

# sea-g2p dùng Cargo.lock v4 — Cargo từ apt Bookworm quá cũ; cần rustup stable.
ENV RUSTUP_HOME=/opt/rustup \
    CARGO_HOME=/opt/cargo
ENV PATH="/opt/cargo/bin:${PATH}"
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- \
    -y \
    --profile minimal \
    --default-toolchain stable \
    --no-modify-path \
    && rustc --version \
    && cargo --version

# Build llama.cpp generic trong Docker (tránh lỗi CPU flags trên một số host/QEMU)
ENV CMAKE_ARGS="-DLLAMA_NATIVE=OFF"
# Ưu tiên wheel khi có (vd. sea-g2p trên linux/arm64)
ENV PIP_PREFER_BINARY=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

COPY check_install.py synth_vieneu.py worker_redis.py ./

ENV PYTHONUNBUFFERED=1
ENV REFERENCE_AUDIO_PATH=/app/input.mp3

CMD ["python", "-u", "worker_redis.py"]
