# GUIDE — worker-tts

---

## Voice ID

Payload `voice_id` hỗ trợ ba định dạng:

| Định dạng      | Ví dụ                     | Engine                    |
|----------------|---------------------------|---------------------------|
| Số nguyên      | `8001`, `5003`            | Revid native (sync)       |
| `edge:<tên>`   | `edge:vi-VN-HoaiMyNeural` | Microsoft Edge TTS (sync) |
| `capcut:<tên>` | `capcut:BV074_streaming`  | CapCut TTS (sync)         |

Default khi không truyền: `capcut:BV074_streaming`. Danh sách đầy đủ: `voice_list.json` ở gốc repo.

## Sync vs Async

- Mặc định worker gọi **async** (`_call_revid_tts_async`): `POST /api/v1/tts/async` lấy `task_id` → poll `GET /api/v1/tasks/{task_id}` mỗi `REVID_ASYNC_POLL` (5s) tới `status=completed`. Bền hơn với API chậm/chương dài. Config `REVID_ASYNC_MAX_WAIT` (600s) + `REVID_ASYNC_POLL` (5s) + `REVID_ASYNC_STATUS_TIMEOUT` (60s, read timeout riêng cho GET status). Lỗi mạng lúc poll (read timeout, connection error) chỉ retry lại poll — không mất task đã submit, không resubmit.
- Có sẵn bản **sync** (`_call_revid_tts`): `POST /api/v1/tts` chờ trực tiếp, trả audio luôn. **Hiện không dùng** — muốn quay lại thì gọi hàm này thay `_call_revid_tts_async`. Read timeout `REVID_READ_TIMEOUT` (mặc định 300s).

---

## Chunking text

Revid API giới hạn ~10 000 ký tự mỗi request. Worker tự tách text thành chunks ≤ 9 000 ký tự theo word boundary, gọi TTS từng chunk (retry 3 lần), dùng ffmpeg ghép thành 1 MP3 nếu nhiều chunk.

---

## Song song (competing consumers)

Mỗi worker xử lý **tuần tự** 1 job tại 1 thời điểm (BLPOP → submit + poll xong mới lấy job kế). Để chạy nhiều chương cùng lúc, dùng **nhiều replica** cùng BLPOP 1 queue `story:tts:queue` — Redis tự chia mỗi job cho 1 worker rảnh.

- 3 service `worker-tts` / `worker-tts-2` / `worker-tts-3` trong `docker-compose.yml`, mỗi service **6 replicas** → tổng **18 luồng**, mỗi nhóm 6 dùng 1 API key Revid riêng (chia tải, giảm rủi ro 1 key bị 429/hết credit ảnh hưởng toàn bộ).
- Override runtime từng nhóm: `docker compose --profile worker-tts up -d --scale worker-tts=N --scale worker-tts-2=N --scale worker-tts-3=N`.
- Hạ số replica nhóm nào nếu key đó trả `429` / hết credit — không cần hạ cả 3 nhóm.

---

## API key

- **key1**: `REVID_API_KEY` trong `worker-tts/.env` (bỏ trống → dùng default hardcode trong `worker_redis.py`).
- **key2 / key3**: đặt trong `worker-tts/.env.key2` / `worker-tts/.env.key3` (chỉ cần dòng `REVID_API_KEY=sk_...`, gitignore) — `docker-compose.yml` load 2 env_file (`.env` rồi `.env.keyN`) nên key2/key3 tự đè lên `.env` cho đúng service.

```
REVID_API_KEY=sk_...
```

---

## Debug thường gặp

**`single mode thiếu voice_id`**
Payload Redis không có `voice_id`. Kiểm tra `WorkerTtsQueue::push()` trong backend.

**`Revid API không trả về audio`**
API key hết hạn hoặc rate limit. Thử override `REVID_API_KEY`.

**ffmpeg không tìm thấy** (lỗi khi ghép chunks)
```bash
sudo apt install ffmpeg
# hoặc đặt FFMPEG_PATH=/đường/dẫn/ffmpeg trong .env
```
