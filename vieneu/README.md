# VieNeu (`vieneu`)

Thư mục này cài **[VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS)** (gói PyPI `vieneu`) trong virtualenv riêng (`.venv/`).

- PyPI: [pypi.org/project/vieneu](https://pypi.org/project/vieneu/)
- Python **≥ 3.10**
- ```winget install -e --id espeak.espeak```

## Cài đặt nhanh

**Windows (PowerShell)** — từ thư mục `Vieneu/`:

```powershell
.\install.ps1
```

**Linux / macOS**:

```bash
chmod +x install.sh
./install.sh
```

### Cài thủ công (giống `install.ps1` / `install.sh`)

Trên **Windows**, nên luôn thêm index wheel CPU (tránh pip build `llama-cpp-python` từ source — cần MSVC):

```powershell
pip install -r requirements.txt --extra-index-url https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/
```

Trên Linux/macOS, cùng lệnh `--extra-index-url` nếu bản wheel phù hợp có trên index đó.

### GPU

Xem [README dự án](https://github.com/pnnbao97/VieNeu-TTS). Gợi ý: tạo venv, cài PyTorch phù hợp CUDA, rồi:

```bash
pip install -r requirements-gpu.txt
```

## Kiểm tra

Sau khi kích hoạt `.venv`:

```bash
python scripts/check_install.py
```

## Ví dụ SDK (sau khi cài xong)

```python
from vieneu import Vieneu

tts = Vieneu()
text = "Xin chào, đây là VieNeu TTS."
audio = tts.infer(text=text)
tts.save(audio, "output.wav")
```

Lần đầu chạy có thể **tải model**; cần mạng và đủ dung lượch ổ đĩa.
