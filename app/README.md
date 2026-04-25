# App (Expo + React Native + Web)

Một codebase: **iOS / Android** (Expo Go hoặc build native), **web** (Metro bundler).

## Yêu cầu

- Node.js **20+**
- iOS: Xcode (trên macOS) nếu build local
- Android: Android Studio / SDK nếu chạy emulator

## Chạy local

```bash
cd app
npm ci
cp .env.example .env
```

Chỉnh `EXPO_PUBLIC_API_URL` trỏ tới Laravel (máy thật thường dùng IP LAN thay vì `localhost` khi test trên điện thoại).

## Cấu hình trong repo

| Nguồn | Mô tả |
|--------|--------|
| `.env` / `.env.example` | `EXPO_PUBLIC_API_URL` (ưu tiên); không commit secret |
| `app.json` → `expo.extra` | `apiUrl` dự phòng khi không set env (mặc định dev) |
| `app.json` → `expo.web` | Bundler Metro, `output` khi export web |

**Docker (service `expo`):** `EXPO_PUBLIC_API_URL`, `CHOKIDAR_USEPOLLING` — xem `docker-compose.yml`.

**Quy ước:** mỗi lần thêm env, `app.json`, EAS, hoặc Docker cho app → cập nhật **`app/README.md`** và **`.cursor/agents/mobile/AGENT.md`**.

```bash
npm start          # Metro + QR Expo Go
npm run web        # Trình duyệt
npm run android    # Emulator
npm run ios        # Simulator (macOS)
```

## Docker (chỉ web dev)

Từ gốc repo: `docker compose up expo` → http://localhost:8090

## Các lệnh chạy trong container

Chạy từ **gốc repo**. Thư mục làm việc trong container: **`/app`** (trùng mount `./app`).

| Mục đích | Lệnh |
|----------|------|
| Cài lại dependency | `docker compose exec expo npm ci` |
| Thêm/cập nhật package Expo | `docker compose exec expo npx expo install <tên-package>` |
| Shell | `docker compose exec expo sh` |

Cần service **`expo`** đang chạy (`docker compose up -d expo`).

## Build app sau này

- **Store / binary**: [EAS Build](https://docs.expo.dev/build/introduction/) (`eas build`).
- **Web tĩnh**: `npx expo export --platform web` (tuỳ cấu hình `app.json` → `web.output`).
