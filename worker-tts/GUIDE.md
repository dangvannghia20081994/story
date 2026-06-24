# GUIDE — worker-tts

---

## Voice ID

Payload `voice_id` hỗ trợ ba định dạng:

| Định dạng | Ví dụ | Engine |
|---|---|---|
| Số nguyên | `8001`, `5003` | Revid native |
| `edge:<tên>` | `edge:vi-VN-HoaiMyNeural` | Microsoft Edge TTS |
| `capcut:<tên>` | `capcut:BV074_streaming` | CapCut TTS |

Default khi không truyền: `capcut:BV074_streaming`. Danh sách đầy đủ: `voice_list.json` ở gốc repo.

---

## Chunking text

Revid API giới hạn ~10 000 ký tự mỗi request. Worker tự tách text thành chunks ≤ 9 000 ký tự theo word boundary, gọi TTS từng chunk (retry 3 lần), dùng ffmpeg ghép thành 1 MP3 nếu nhiều chunk.

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
