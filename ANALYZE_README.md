# Story Analyzer — Ollama Local

Phân tích chapter truyện bằng `qwen2.5:3b` chạy local qua Ollama. Output: `{chapter_id}.json` chứa danh sách nhân vật + content_segments gán speaker.

## Yêu cầu

- [Ollama](https://ollama.com) đã cài và đang chạy (`ollama serve`)
- Python 3.10+
- Postgres chứa bảng `chapters` + `stories` (hoặc dùng stdin để bỏ qua DB)

## Cài đặt

```bash
# 1. Cài Python dependencies
pip install psycopg2-binary requests

# 2. Pull model base
ollama pull qwen2.5:3b

# 3. Build model với system prompt story-analyzer
ollama create story-analyzer -f Modelfile
```

## Cấu hình

Biến môi trường (có thể đặt trong `.env` và `source` trước khi chạy):

| Biến           | Mặc định                                        | Mô tả                 |
|----------------|-------------------------------------------------|-----------------------|
| `DATABASE_URL` | `postgresql://story:story@localhost:5432/story` | Postgres DSN          |
| `OLLAMA_URL`   | `http://localhost:11434`                        | Địa chỉ Ollama server |
| `OLLAMA_MODEL` | `story-analyzer`                                | Tên model đã build    |

## Sử dụng

### Phân tích 1 chapter theo ID

```bash
python analyze_chapter.py --chapter-id 42
```

Output: `./analysis/42.json`

### Phân tích toàn bộ story (chỉ chapter chưa analyzed)

```bash
python analyze_chapter.py --story-id 1 --out-dir ./analysis/truyen-abc
```

Output: `./analysis/truyen-abc/{chapter_id}.json` cho từng chapter.

### Chỉ định thư mục output

```bash
python analyze_chapter.py --chapter-id 42 --out-dir ./output
```

### Từ stdin (không cần DB)

```bash
echo "Lâm Phong nói: 'Ta sẽ không bỏ cuộc.'" | python analyze_chapter.py --chapter-id 99
```

### Override model tạm thời

```bash
python analyze_chapter.py --chapter-id 42 --model qwen2.5:7b
```

## Format output

Mỗi chapter → 1 file `{chapter_id}.json`:

```json
{
  "chapter_id": 42,
  "chapter_number": 3,
  "title": "Chương 3: Khởi đầu",
  "characters": [
    {
      "name": "Lâm Phong",
      "aliases": ["Phong", "hắn"],
      "freq": 24,
      "dialogue_count": 10
    }
  ],
  "content_segments": [
    { "speaker": "narration", "text": "Bầu trời tối sầm lại..." },
    { "speaker": "Lâm Phong", "text": "Ta sẽ không bỏ cuộc." },
    { "speaker": "_unknown", "text": "Ai đó thì thầm trong bóng tối." }
  ]
}
```

**Giá trị `speaker`:**
- Tên nhân vật — lời thoại xác định được chủ thể
- `narration` — tường thuật, sound effect, tên bí kíp trong quote
- `_unknown` — không xác định được, cần review thủ công

## Rebuild model sau khi sửa Modelfile

```bash
ollama rm story-analyzer
ollama create story-analyzer -f Modelfile
```

## Troubleshoot

**Ollama không chạy**
```bash
ollama serve &
```

**Lỗi kết nối DB** — kiểm tra `DATABASE_URL` hoặc dùng stdin để bỏ qua DB.

**Output không phải JSON hợp lệ** — model nhỏ đôi khi wrap thêm text. Script tự tách JSON ra khỏi markdown block. Nếu vẫn lỗi, thử model lớn hơn: `--model qwen2.5:7b`.

**Chapter bị skip** — chapter đó có `content` rỗng trong DB.
