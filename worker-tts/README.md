# worker-tts

Worker lắng nghe Redis (BLPOP), gọi **Revid TTS API**, upload audio chương về backend.

---

## Payload Redis

Backend đẩy job bằng `RPUSH` vào list `WORKER_TTS_REDIS_QUEUE` (mặc định `story:tts:queue`):

```json
{"chapter_id": 12, "mode": "single", "text": "Plain text...", "voice_id": "capcut:BV074_streaming"}
```

Trong Laravel:
```php
WorkerTtsQueue::push($chapter, voiceId: 'capcut:BV074_streaming');
```

---

## Cài đặt

Yêu cầu: Python 3.10+, `ffmpeg` (ghép MP3 khi text > 9000 ký tự).

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

cd worker-tts
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

**Windows:** dùng `run_worker_redis.cmd`.

---

## Cấu hình `.env`

Copy từ `.env.example`:

```
WORKER_TTS_INTERNAL_TOKEN=   # khớp backend/.env
BACKEND_API_BASE_URL=http://127.0.0.1:8000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
WORKER_TTS_REDIS_QUEUE=story:tts:queue
# REVID_API_KEY=sk_...       # tuỳ chọn, override key mặc định
# REVID_ASYNC_MAX_WAIT=600   # async: tối đa chờ poll (giây)
# REVID_ASYNC_POLL=5         # async: nhịp poll /tasks/{id} (giây)
# REVID_ASYNC_STATUS_TIMEOUT=60  # async: read timeout riêng cho GET /tasks/{id} (giây)
# REVID_READ_TIMEOUT=300     # sync (dự phòng): read timeout (giây)
# WORKER_TTS_MAX_CHARS=9000  # giới hạn ký tự mỗi chunk
```

---

## Chạy

```bash
source .venv/bin/activate
python worker_redis.py
```

---

## Docker

```bash
docker compose --profile worker-tts up -d --build worker-tts
```

Mặc định lên **6 replicas** song song (`worker-tts.deploy.replicas: 6` trong `docker-compose.yml`) — xem mục [Song song](#song-song) bên dưới.

---

## Sync vs Async

- **Mặc định async** (`_call_revid_tts_async`): `POST /api/v1/tts/async` lấy `task_id` → poll `GET /api/v1/tasks/{task_id}` mỗi `REVID_ASYNC_POLL` (5s) tới `status=completed`. Bền hơn với chương dài / API chậm. Config `REVID_ASYNC_MAX_WAIT` (600s) + `REVID_ASYNC_POLL` (5s) + `REVID_ASYNC_STATUS_TIMEOUT` (60s). Lỗi mạng khi poll (vd read timeout) chỉ retry lại poll, không resubmit task.
- **Sync dự phòng** (`_call_revid_tts`): `POST /api/v1/tts` chờ trực tiếp, trả audio luôn. Hiện không dùng — muốn quay lại thì gọi hàm này thay `_call_revid_tts_async` trong `_process_revid_single`. Read timeout `REVID_READ_TIMEOUT` (300s).

> ⚠️ `progress` từ API đứng yên ~8% suốt rồi nhảy 100% → log chỉ hiển thị thời gian chờ + message, không hiển thị %.

---

## Song song

Mỗi worker xử lý **tuần tự** 1 job/lần (BLPOP → submit + poll xong mới lấy job kế). Chạy nhiều chương cùng lúc bằng **nhiều replica** cùng BLPOP 1 queue — Redis tự chia mỗi job cho 1 worker rảnh (competing consumers).

- 3 service `worker-tts` / `worker-tts-2` / `worker-tts-3`, mỗi service **6 replicas** → tổng **18 luồng**, mỗi nhóm dùng 1 API key Revid riêng (`.env` / `.env.key2` / `.env.key3`) để chia tải giữa 3 key.
- Override runtime: `docker compose --profile worker-tts up -d --scale worker-tts=N --scale worker-tts-2=N --scale worker-tts-3=N`.
- Hạ replica nhóm nào nếu key đó trả `429` / hết credit — xem chi tiết cách gán key ở [GUIDE.md](GUIDE.md#api-key).

---

## Voice ID

| Định dạng      | Ví dụ                     | Engine             |
|----------------|---------------------------|--------------------|
| Số nguyên      | `8001`, `5003`            | Revid native       |
| `edge:<tên>`   | `edge:vi-VN-HoaiMyNeural` | Microsoft Edge TTS |
| `capcut:<tên>` | `capcut:BV074_streaming`  | CapCut TTS         |

Danh sách đầy đủ: `voice_list.json` ở gốc repo. Mọi engine đều đi qua luồng async mặc định.
