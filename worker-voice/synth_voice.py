#!/usr/bin/env python3
"""
Tổng hợp giọng (XTTS + clone theo file mẫu, mặc định voice.wav).

- ``--model auto`` (mặc định): nếu có ``models/yukiakai-viXTTS/`` hoặc ``models/ntdgo-ttsvi/``
  (``install_vixtts_yukiakai.py`` / ``install_vi_model.py``) thì dùng **viXTTS**; không thì XTTS gốc.
- Model cục bộ: ``--model /đường/dẫn/thư_mục`` (có ``model.pth`` + ``config.json``).

  python install_vixtts_yukiakai.py
  python synth_voice.py --list-languages
  python synth_voice.py --text "Câu tiếng Việt cần đọc."
"""

from __future__ import annotations

import argparse
import sys
import warnings
from pathlib import Path


STOCK_MODEL = "tts_models/multilingual/multi-dataset/xtts_v2"
SCRIPT_DIR = Path(__file__).resolve().parent
# Thứ tự ưu tiên cho --model auto (thư mục con của models/)
VI_LOCAL_DIRS = (
    SCRIPT_DIR / "models" / "yukiakai-viXTTS",
    SCRIPT_DIR / "models" / "ntdgo-ttsvi",
)


def _patch_xtts_vietnamese_tokenizer() -> None:
    """viXTTS có ``vi`` trong config nhưng ``VoiceBpeTokenizer`` của Coqui chưa preprocess ``vi``.

    Dùng bước làm sạch giống ``en`` (chữ Latin); ``encode`` vẫn gắn prefix ``[vi]`` như model học.
    """
    from TTS.tts.layers.xtts.tokenizer import VoiceBpeTokenizer

    if getattr(VoiceBpeTokenizer.preprocess_text, "_vi_fallback_patch", False):
        return

    _orig = VoiceBpeTokenizer.preprocess_text

    def preprocess_text(self, txt: str, lang: str) -> str:
        if lang == "vi":
            return _orig(self, txt, "en")
        return _orig(self, txt, lang)

    preprocess_text._vi_fallback_patch = True
    VoiceBpeTokenizer.preprocess_text = preprocess_text


def local_vi_checkpoint() -> tuple[str, str, Path] | None:
    """(thư_mục checkpoint, config.json, thư_mục) — Coqui XTTS cần ``checkpoint_dir`` (thư mục), không phải ``model.pth``."""
    for root in VI_LOCAL_DIRS:
        cfg = root / "config.json"
        ckpt = root / "model.pth"
        if cfg.is_file() and ckpt.is_file():
            return str(root), str(cfg), root
    return None


def effective_language(code: str) -> str:
    c = code.strip().lower()
    return "zh-cn" if c == "zh" else c


def supported_languages(tts) -> list[str]:
    m = getattr(tts.synthesizer, "tts_model", None)
    cfg = getattr(m, "config", None) if m else None
    langs = getattr(cfg, "languages", None)
    return list(langs) if langs is not None else []


def create_tts(model_arg: str, device: str, progress_bar: bool = True):
    """Trả về TTS đã .to(device)."""
    from TTS.api import TTS

    _patch_xtts_vietnamese_tokenizer()

    ma = model_arg.strip()
    if ma in ("auto", ""):
        lp = local_vi_checkpoint()
        if lp:
            checkpoint_dir, c_path, used_dir = lp
            print(f"Model: viXTTS cục bộ ({used_dir})")
            return TTS(model_path=checkpoint_dir, config_path=c_path, progress_bar=progress_bar).to(device)
        print(
            f"Model: {STOCK_MODEL} (chưa có checkpoint VI — chạy: "
            "python install_vixtts_yukiakai.py hoặc python install_vi_model.py)"
        )
        return TTS(STOCK_MODEL, progress_bar=progress_bar).to(device)

    p = Path(ma).expanduser()
    if p.is_dir():
        ck, cfg = p / "model.pth", p / "config.json"
        if ck.is_file() and cfg.is_file():
            print(f"Model: cục bộ {p}")
            return TTS(model_path=str(p), config_path=str(cfg), progress_bar=progress_bar).to(device)

    print(f"Model: {ma}")
    return TTS(ma, progress_bar=progress_bar).to(device)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="TTS clone giọng (XTTS / viXTTS).")
    p.add_argument(
        "--text",
        default=None,
        help="Văn bản (mặc định: câu mẫu theo ngôn ngữ model).",
    )
    p.add_argument(
        "--speaker",
        type=Path,
        default=SCRIPT_DIR / "voice.wav",
        help="File giọng mẫu. Mặc định: worker-voice/voice.wav",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=SCRIPT_DIR / "output.wav",
        help="File WAV ra. Mặc định: worker-voice/output.wav",
    )
    p.add_argument(
        "--model",
        default="auto",
        help=f'"auto" = models/yukiakai-viXTTS hoặc models/ntdgo-ttsvi nếu có, không thì {STOCK_MODEL}; hoặc đường dẫn checkpoint / tên model Coqui.',
    )
    p.add_argument(
        "--language",
        default=None,
        help="Mã ngôn ngữ (vd: vi, en). Mặc định: vi nếu model hỗ trợ, không thì en.",
    )
    p.add_argument(
        "--list-languages",
        action="store_true",
        help="Tải model, in mã ngôn ngữ rồi thoát.",
    )
    p.add_argument("--device", default=None, help="cpu hoặc cuda (mặc định: tự chọn).")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    speaker = args.speaker.expanduser().resolve()
    out_path = args.out.expanduser().resolve()

    try:
        import torch
    except ImportError as e:
        print(e, file=sys.stderr)
        print("Chạy: pip install -r requirements.txt", file=sys.stderr)
        return 1

    warnings.filterwarnings(
        "ignore",
        message=r"In 2\.9, this function's implementation will be changed",
        category=UserWarning,
        module=r"torchaudio\._backend\.utils",
    )

    if args.device:
        device = args.device
    else:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    print(f"Thiết bị: {device}")

    tts = create_tts(args.model, device)

    langs = supported_languages(tts)
    if args.language is None:
        args.language = "vi" if "vi" in langs else "en"
    if args.text is None:
        if args.language == "vi":
            args.text = "Xin chào, đây là thử nghiệm đọc tiếng Việt bằng giọng clone từ file mẫu. Tôi tên lè Lê Văn Chiến, làm PM của dự án Rezil. Hôm nay là ngày phải xử lý xong ticket performance của PLAN-001. Nếu mà không xong là xong đời luôn đấy. Điếc con mẹ nó luôn"
        else:
            args.text = "This is a short test of voice cloning from your reference audio."

    if args.list_languages:
        print("Ngôn ngữ model hỗ trợ:", ", ".join(langs) if langs else "(không đọc được từ config)")
        if langs and "vi" not in langs:
            print(
                "\nModel này không có tiếng Việt. Chạy một trong: "
                "python install_vixtts_yukiakai.py  |  python install_vi_model.py"
                "\n(rồi synth_voice --model auto)."
            )
        return 0

    if not speaker.is_file():
        print(f"Không thấy file giọng mẫu: {speaker}", file=sys.stderr)
        print("Đặt voice.wav cạnh script hoặc --speaker /đường/dẫn/file.wav", file=sys.stderr)
        return 1

    lang_eff = effective_language(args.language)
    if langs and lang_eff not in langs:
        print(
            f"Lỗi: --language '{args.language}' (→ '{lang_eff}') không có trong model.",
            file=sys.stderr,
        )
        print(f"Các mã hợp lệ: {langs}", file=sys.stderr)
        return 1

    print(f"Giọng mẫu: {speaker}")
    print(f"Ra file: {out_path}")
    print(f"Ngôn ngữ: {lang_eff}")

    out_path.parent.mkdir(parents=True, exist_ok=True)

    tts.tts_to_file(
        text=args.text,
        speaker_wav=str(speaker),
        language=lang_eff,
        file_path=str(out_path),
    )
    print("Xong.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
