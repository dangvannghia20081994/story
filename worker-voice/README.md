# worker-voice

Thư mục dùng **Python + [Coqui TTS](https://pypi.org/project/coqui-tts/)** (`coqui-tts` trên PyPI, fork [idiap/coqui-ai-TTS](https://github.com/idiap/coqui-ai-TTS)) để thử tổng hợp giọng nói (ví dụ XTTS, tiếng Việt, voice cloning).

## Yêu cầu

- **Python 3.10–3.14**
- Mạng ổn định khi **lần đầu** tải checkpoint mô hình (có thể vài GB tùy model).

## Cài đặt nhanh

```bash
cd worker-voice
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt
python check_install.py
```

- **`requirements.txt`**: Torch **CPU** (`2.8.0+cpu`) qua index PyTorch, `coqui-tts==0.27.5`, `transformers>=4.46,<5` (tránh xung đột với transformers 5.x).
- **GPU**: chỉnh theo comment trong `requirements.txt` và [hướng dẫn PyTorch](https://pytorch.org/get-started/locally/); với torch ≥ 2.9 thường cần thêm `torchcodec>=0.8`.

Nếu `python3 -m venv` báo thiếu `ensurepip` (Ubuntu): `sudo apt install python3.12-venv` (đổi đúng bản Python), hoặc `python3 -m venv --without-pip .venv` rồi [get-pip](https://bootstrap.pypa.io/get-pip.py).

## Kiểm tra & CLI

```bash
python check_install.py          # import torch + TTS.api
tts --list_models                  # sau khi activate venv
```

## Tài liệu chi tiết

- **`GUIDE.md`** — mô hình gợi ý (XTTS, viXTTS), file giọng mẫu, ví dụ `tts_to_file`, tối ưu tham số.
- **Tài liệu chính thức:** [coqui-tts.readthedocs.io](https://coqui-tts.readthedocs.io/en/latest/)

## Cấu trúc thư mục

| File / thư mục     | Mô tả                                      |
|--------------------|--------------------------------------------|
| `requirements.txt` | Phụ thuộc pip (Coqui + Torch CPU + pin HF) |
| `GUIDE.md`         | Hướng dẫn dài, ví dụ code                  |
| `check_install.py` | Kiểm tra môi trường sau khi cài            |
| `.venv/`           | Virtualenv (đã liệt kê trong `.gitignore`) |
