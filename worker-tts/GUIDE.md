# GUIDE — worker-tts

---

## Voice ID

Payload `voice_id` hỗ trợ ba định dạng:

| Định dạng | Ví dụ | Engine |
|---|---|---|
| Số nguyên | `8001`, `5003` | Revid native (sync) |
| `edge:<tên>` | `edge:vi-VN-HoaiMyNeural` | Microsoft Edge TTS (sync) |
| `capcut:<tên>` | `capcut:BV074_streaming` | CapCut TTS (sync) |

Default khi không truyền: `capcut:BV074_streaming`. Danh sách đầy đủ: `voice_list.json` ở gốc repo.

## Sync vs Async

- Mặc định worker gọi **async** (`_call_revid_tts_async`): `POST /api/v1/tts/async` lấy `task_id` → poll `GET /api/v1/tasks/{task_id}` mỗi `REVID_ASYNC_POLL` (5s) tới `status=completed`. Bền hơn với API chậm/chương dài. Config `REVID_ASYNC_MAX_WAIT` (600s) + `REVID_ASYNC_POLL` (5s).
- Có sẵn bản **sync** (`_call_revid_tts`): `POST /api/v1/tts` chờ trực tiếp, trả audio luôn. **Hiện không dùng** — muốn quay lại thì gọi hàm này thay `_call_revid_tts_async`. Read timeout `REVID_READ_TIMEOUT` (mặc định 300s).

---

## Chunking text

Revid API giới hạn ~10 000 ký tự mỗi request. Worker tự tách text thành chunks ≤ 9 000 ký tự theo word boundary, gọi TTS từng chunk (retry 3 lần), dùng ffmpeg ghép thành 1 MP3 nếu nhiều chunk.

---

## Song song (competing consumers)

Mỗi worker xử lý **tuần tự** 1 job tại 1 thời điểm (BLPOP → submit + poll xong mới lấy job kế). Để chạy nhiều chương cùng lúc, dùng **nhiều replica** cùng BLPOP 1 queue `story:tts:queue` — Redis tự chia mỗi job cho 1 worker rảnh.

- Mặc định **6 replicas** (ghi cố định trong `docker-compose.yml`: `worker-tts.deploy.replicas: 6`).
- Override runtime: `docker compose --profile worker-tts up -d --scale worker-tts=N worker-tts`.
- Hạ số replica nếu Revid API trả `429` / hết credit (6 worker gọi API đồng thời).

---

## API key

Key mặc định hardcode trong `worker_redis.py`. Override qua env:

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
