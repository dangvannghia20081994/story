# worker-voice

Thư mục dùng **Python + [Coqui TTS](https://pypi.org/project/coqui-tts/)** (`coqui-tts`) cho XTTS / voice cloning. **Tiếng Việt:** tải **[yukiakai/viXTTS](https://huggingface.co/yukiakai/viXTTS)** (`install_vixtts_yukiakai.py`) hoặc **[ntdgo/ttsvi](https://huggingface.co/ntdgo/ttsvi)** (`install_vi_model.py`) — `synth_voice.py --model auto` ưu tiên `models/yukiakai-viXTTS/` rồi `models/ntdgo-ttsvi/` (xem mục 5).

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

- **`requirements.txt`**: Torch **CPU** (`2.8.0+cpu`), `coqui-tts==0.27.5`, `transformers>=4.46,<5`, `huggingface_hub` (tải model VI).
- **GPU**: chỉnh theo comment trong `requirements.txt` và [hướng dẫn PyTorch](https://pytorch.org/get-started/locally/); với torch ≥ 2.9 thường cần thêm `torchcodec>=0.8`.

Nếu `python3 -m venv` báo thiếu `ensurepip` (Ubuntu): `sudo apt install python3.12-venv` (đổi đúng bản Python), hoặc `python3 -m venv --without-pip .venv` rồi [get-pip](https://bootstrap.pypa.io/get-pip.py).

## Chạy sau khi cài

Luôn **bật venv** trước (`source .venv/bin/activate` hoặc đường dẫn tuyệt đối tới `.venv/bin/python`).

### 1. Kiểm tra môi trường (không tải model)

```bash
cd worker-voice
source .venv/bin/activate
python check_install.py
```

### 2. Xem model có sẵn (CLI `tts`)

```bash
tts --list_models
tts --model_info_by_name "tts_models/multilingual/multi-dataset/xtts_v2"
```

### 3. Tổng hợp thử bằng CLI (XTTS v2 + giọng mẫu)

XTTS cần **file giọng mẫu** (WAV/MP3, vài giây, giọng rõ). **Stock** `xtts_v2` **không** có mã `vi` — dùng `en` (hoặc mã trong `tts --list_language_idxs` với model của bạn). Tiếng Việt cần model fine-tune có `vi`.

```bash
tts --text "This is a short test sentence." \
  --model_name "tts_models/multilingual/multi-dataset/xtts_v2" \
  --language_idx en \
  --speaker_wav /đường/dẫn/tới/mau_giong.wav \
  --out_path ./out_demo.wav
```

Lần đầu chạy model, Coqui sẽ **tải checkpoint** (lâu, cần mạng).

### 4. Chạy bằng Python (API)

```bash
source .venv/bin/activate
python -c "
import torch
from TTS.api import TTS
device = 'cuda' if torch.cuda.is_available() else 'cpu'
tts = TTS('tts_models/multilingual/multi-dataset/xtts_v2').to(device)
tts.tts_to_file(
    text='A short test sentence.',
    speaker_wav='mau_giong.wav',
    language='en',
    file_path='out_api.wav',
)
print('Xong: out_api.wav')
"
```

Đổi `mau_giong.wav` thành file thật của bạn. Tham số `temperature`, `repetition_penalty`, … có thể truyền thêm vào `tts_to_file` tùy phiên bản; xem [Inference](https://coqui-tts.readthedocs.io/en/latest/inference.html).

### 5. Model tiếng Việt (yukiakai / ntdgo, viXTTS) + `synth_voice.py`

Hai repo Hugging Face cùng kiểu checkpoint (`config.json`, `model.pth`, `vocab.json`), có mã **`vi`** trong config, load qua `TTS(model_path=..., config_path=...)`.

```bash
source .venv/bin/activate
# Một trong hai (hoặc cả hai — auto ưu tiên yukiakai trước):
python install_vixtts_yukiakai.py --remove-stock-xtts   # → models/yukiakai-viXTTS/
# python install_vi_model.py --remove-stock-xtts        # → models/ntdgo-ttsvi/

python synth_voice.py --list-languages    # phải thấy vi
python synth_voice.py --text "Câu tiếng Việt cần đọc."
```

`synth_voice.py` mặc định **`--model auto`**: nếu có `models/yukiakai-viXTTS/` thì dùng repo đó; không thì `models/ntdgo-ttsvi/`; chưa tải gì thì XTTS Coqui gốc (không có `vi`). Ép một thư mục: `--model models/yukiakai-viXTTS` hoặc `--model models/ntdgo-ttsvi`.

**Gỡ model cũ:** cờ `--remove-stock-xtts` xóa bản tải sẵn **`tts_models--multilingual--multi-dataset--xtts_v2`** trong `~/.local/share/tts/`. Bản tải tay qua `tts --model_name ...` vẫn có thể tải lại nếu cần.

Nếu chỉ cần TTS tiếng Việt nhẹ, không XTTS: xem **[Piper](https://github.com/rhasspy/piper)**.

## Tài liệu

- **Coqui TTS:** [coqui-tts.readthedocs.io](https://coqui-tts.readthedocs.io/en/latest/)

## Cấu trúc thư mục

| File / thư mục     | Mô tả                                      |
|--------------------|--------------------------------------------|
| `requirements.txt` | Phụ thuộc pip (Coqui + Torch CPU + pin HF) |
| `check_install.py` | Kiểm tra môi trường sau khi cài            |
| `install_vixtts_yukiakai.py` | Tải `yukiakai/viXTTS` → `models/yukiakai-viXTTS/` |
| `install_vi_model.py` | Tải `ntdgo/ttsvi` → `models/ntdgo-ttsvi/` + tùy chọn xóa cache XTTS gốc |
| `synth_voice.py`   | `--model auto` → yukiakai rồi ntdgo nếu có, không thì XTTS gốc |
| `models/`          | Chứa weight (xem `.gitignore`)                  |
| `.venv/`           | Virtualenv (đã liệt kê trong `.gitignore`)      |
