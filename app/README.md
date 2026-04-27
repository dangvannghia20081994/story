# App (Expo + React Native + Web)

Một codebase: **iOS / Android** (Expo Go hoặc build native), **web** (Metro bundler).

## Yêu cầu

- Node.js **20+**
- iOS: Xcode (trên macOS) nếu build local
- Android: Android Studio / SDK nếu chạy emulator

## Chạy local

```bash
cd app
npm install
cp .env.example .env
```

Chỉnh `EXPO_PUBLIC_API_URL` trỏ tới Laravel (máy thật thường dùng IP LAN thay vì `localhost` khi test trên điện thoại).

**CORS (Expo web trong trình duyệt):** origin là URL trang (vd. `http://localhost:8090`) phải được backend chấp nhận. Với `APP_ENV=local`, Laravel tự thêm pattern `localhost` / `127.0.0.1` mọi cổng (`config/cors.php`). Nếu vẫn lỗi: thêm origin vào `CORS_ALLOWED_ORIGINS` trong `backend/.env`, rồi `php artisan config:clear`.

## Cấu hình trong repo

| Nguồn | Mô tả |
|--------|--------|
| `.env` / `.env.example` | `EXPO_PUBLIC_API_URL` (ưu tiên); không commit secret |
| `app.json` → `expo.extra` | `apiUrl` dự phòng khi không set env (mặc định dev) |
| `app.json` → `expo.web` | Bundler Metro, `output` khi export web |
| `constants/storyUi.ts` + `constants/Colors.ts` | Màu nền / shell / indigo bám theo web (`frontend` globals + trang truyện/chương) |
| `lib/webTitle.ts` | Chỉ web: `document.title` theo màn hình (suffix từ `app.json` → `expo.name`) |

Chi tiết truyện trong app: API `chapters_limit` / `chapters_offset` + nút **Tải thêm** và tự gọi khi cuộn gần cuối; màn đọc chương dùng `chapters_full=1`.

**Docker (service `expo`):** `EXPO_PUBLIC_API_URL`, `CHOKIDAR_USEPOLLING` — xem `docker-compose.yml`.

**Quy ước:** mỗi lần thêm env, `app.json`, EAS, hoặc Docker cho app → cập nhật **`app/README.md`** và **`.cursor/agents/mobile/AGENT.md`**.

```bash
npm start          # Metro + QR Expo Go
npm run web        # Trình duyệt
npm run android    # Emulator
npm run ios        # Simulator (macOS)
```

## Docker (chỉ web dev)

Từ gốc repo: `docker compose up expo` → **http://localhost:8090** (Nginx/Compose map **8090 → 8081** trong container, vì Metro web dùng cổng **8081**).

Expo CLI chỉ nhận `--host lan|tunnel|localhost` (không dùng `0.0.0.0`). Lần đầu chạy, service chạy `npm install` trước khi start để đồng bộ `node_modules` trên volume với `package-lock.json`.

## Các lệnh chạy trong container

Chạy từ **gốc repo**. Thư mục làm việc trong container: **`/app`** (trùng mount `./app`).

| Mục đích | Lệnh |
|----------|------|
| Cài lại dependency | `docker compose exec expo npm install` |
| Thêm/cập nhật package Expo | `docker compose exec expo npx expo install <tên-package>` |
| Shell | `docker compose exec expo sh` |

Cần service **`expo`** đang chạy (`docker compose up -d expo`).

## Build app sau này

- **Store / binary**: [EAS Build](https://docs.expo.dev/build/introduction/) (`eas build`).
- **Web tĩnh**: `npx expo export --platform web` (tuỳ cấu hình `app.json` → `web.output`).
