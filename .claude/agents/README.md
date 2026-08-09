# Claude Code agents — project `story`

Project-local agents (chỉ load khi Claude Code chạy trong `/home/nghiadv/IdeaProjects/story`). Theo cấu trúc Lucy-style: 1 coordinator + 7 sub-agent theo layer.

> Đọc thêm: **`CLAUDE.md`** ở root repo — context tổng quan + routing nhanh cho assistant khi mở repo.

## Cấu trúc

```
story-master (opus, coordinator)
├── backend-laravel        — Laravel API + CMS Blade
├── frontend-next          — Next.js web
├── mobile-expo            — Expo (RN + web)
├── worker-crawler-python  — Playwright crawler worker
├── worker-tts-python      — Python TTS workers (worker-tts + worker-voice)
├── devops-docker          — Docker Compose + nginx
├── db-postgres            — Postgres query helper (read-only mặc định)
├── story-analyzer         — Phân tích truyện thủ công: NER nhân vật + gom thoại + insert characters/lexicons
└── audio-merger           — Ghép nhiều file MP3 thành 1 file MP3 bằng ffmpeg
```

## Khi nào dùng agent nào

| User intent / file đụng | Agent |
|---|---|
| Sửa route API, controller, migration, CMS Blade, model Laravel | `backend-laravel` |
| Sửa page Next.js, component web, audio player web, SSR fetch | `frontend-next` |
| Sửa screen Expo, RN, web Metro, EAS, `app.json` | `mobile-expo` |
| Sửa logic crawl Playwright, selector mục lục/chương, `worker.py` | `worker-crawler-python` |
| Sửa pipeline TTS, model selection, upload format mp3/m4a | `worker-tts-python` |
| Sửa `docker-compose.yml`, Dockerfile, nginx, port, profile | `devops-docker` |
| Query Postgres để debug data | `db-postgres` |
| Phân tích truyện thủ công (manual NER theo story_id, gom thoại, insert đợt lớn) | `story-analyzer` |
| Ghép/nối nhiều file MP3 thành 1, thêm khoảng lặng, normalize volume | `audio-merger` |
| Task chạm ≥2 layer / cần điều phối | `story-master` (coordinator) |

## Quy ước chung — văn phong response (bắt buộc)

Rule này đã được append vào **cuối cả 10 file agent** trong folder này (mục `## Từ ngữ trong response`).
Đây là bản gốc để copy khi thêm agent mới. Viết như kỹ sư báo cáo, từ trung tính, mô tả ĐÚNG dữ liệu.

5 nhóm phải tránh:

1. **Ẩn dụ / giật gân** — "đau nhất", "toang", "chết", "vỡ", "khủng (khiếp)", "cực gắt", "bùng nổ", "báo động đỏ", "điểm nóng", "thảm hoạ", "đỉnh", "cân hết", "ăn hành", "cháy máy".
2. **Ghép từ sượng / dịch máy** — "đắt xấp xỉ", "nhanh xấp xỉ", "rẻ bất thường" (viết "giá gần bằng…", "xấp xỉ \<số\>", "nhanh bất thường"); "một cách nhanh chóng", "điều này có nghĩa là", "hãy cùng đi sâu vào", "bức tranh toàn cảnh", "con số biết nói".
3. **Phóng đại / marketing** — "hoàn hảo", "xuất sắc", "vượt trội", "đột phá", "siêu nhanh", "cực kỳ", "ấn tượng" → thay bằng SỐ ĐO cụ thể.
4. **Filler AI / cảm thán** — "Tuyệt vời!", "Chính xác!", "Câu hỏi hay", "Hy vọng điều này giúp ích", emoji ăn mừng (🎉✨🚀).
5. **Văn nói / teencode** — "tụi mình" (→ "chúng tôi"), "mấy file/mấy chỗ" (→ "các …"), "ngon lành", "xịn", "hơi bị", "ok luôn", "code chuối".

Bảng thay thế đã chốt (dùng lại, không chế từ mới):

| Cũ | Mới |
|---|---|
| bảng đau nhất | bảng chịu tải nặng nhất |
| chỗ vỡ / thứ tự vỡ / total chết trước | điểm nghẽn / thứ tự xuất hiện điểm nghẽn / total chậm trước |
| chỗ `STRAIGHT_JOIN` kiếm cơm | chỗ `STRAIGHT_JOIN` phát huy tác dụng |
| bảng join thứ N cắn mạnh nhất | ảnh hưởng mạnh nhất |
| nơi để nhét những thứ đắt | nơi đặt những phép tính tốn kém |
| không ăn thua / mới ăn / chỉ ăn khi | không có tác dụng / mới có tác dụng / chỉ có tác dụng khi |
| index này để cứu bảng kia | để tối ưu / xử lý triệt để |
| nhiễu đọc đĩa nuốt mất | che mất |
| dính vào là nhân row khủng khiếp | nếu dùng thì nhân row rất lớn |
| kỉ luật hai bước / phá kỉ luật | nguyên tắc hai bước / phá vỡ nguyên tắc |
| bảng X bé tí | bảng X rất nhỏ |
| shape mặc định rẻ bất thường | dạng mặc định nhanh bất thường |
| quy tắc ngón tay cái | quy tắc ước lượng nhanh |
| row mồ côi | row trỏ tới bản ghi không tồn tại |

Tiêu đề bảng / nhãn cột / tên mục = danh từ mô tả đúng dữ liệu ("Chương lỗi TTS nhiều nhất", "Top 5 truyện theo lượt đọc") — không cảm thán, không emoji trang trí. Giữ tiếng Anh cho thuật ngữ chuẩn ngành (`queue`, `worker`, `migration`, tên lệnh/branch/commit); KHÔNG chèn tiếng Anh lửng giữa câu tiếng Việt.

## Quan hệ với `.cursor/agents/`

Folder `.cursor/agents/` là sub-agent cho **Cursor IDE** — **đủ 9 agent** (1 coordinator + 8 specialist), đồng bộ với folder này:

- File phẳng `.cursor/agents/<name>.md` — Cursor Task tool / `/tên-agent`
- Thư mục `.cursor/agents/<layer>/AGENT.md` — @-mention thủ công trong chat

Khi sửa bất kỳ agent nào: sync **`.cursor/agents/<name>.md`**, **`.cursor/agents/<layer>/AGENT.md`** (nếu có), và **`.claude/agents/<name>.md`** + README folder code.

## Bổ sung mới

- Agent cho layer mới (vd `coqui/`) → tạo file mới trong folder này, update bảng routing ở trên + `story-master.md` mục "Cấu trúc team", và copy mục `## Từ ngữ trong response` (xem "Quy ước chung — văn phong response" ở trên) vào cuối file agent mới.
- Đổi tool / model của agent → sửa frontmatter `name:` / `model:` / `tools:` của file đó.

## Tham khảo

- Convention dev project: `README.md` gốc repo, `backend/README.md`, `frontend/README.md`, `app/README.md`, `worker-crawler/README.md`, `worker-tts/README.md`, `docker/README.md`.
- Cursor agents tương ứng: `.cursor/agents/README.md`.
