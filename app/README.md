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

Chỉnh `EXPO_PUBLIC_API_URL` trỏ tới Laravel. Trên **điện thoại thật** không dùng được `localhost` / `127.0.0.1` (đó là chính điện thoại) — dùng **IP LAN** của máy dev; chi tiết ở mục **Chạy trên điện thoại Android** bên dưới.

**CORS (Expo web trong trình duyệt):** origin là URL trang (vd. `http://localhost:8090`) phải được backend chấp nhận. Với `APP_ENV=local`, Laravel tự thêm pattern `localhost` / `127.0.0.1` mọi cổng (`config/cors.php`). Nếu vẫn lỗi: thêm origin vào `CORS_ALLOWED_ORIGINS` trong `backend/.env`, rồi `php artisan config:clear`.

## Chạy trên điện thoại Android (Expo Go)

1. **Cùng mạng Wi‑Fi** giữa máy dev và điện thoại (trừ khi dùng tunnel ở bước 8).
2. **Lấy IP LAN** của máy dev, ví dụ Linux: `hostname -I | awk '{print $1}'` — gọi là `<IP_LAN>` (dạng `192.168.x.x`).
3. Trong `app/.env`, đặt API Laravel (cổng mặc định 8000):
   ```env
   EXPO_PUBLIC_API_URL=http://<IP_LAN>:8000
   ```
   Sau khi sửa `.env`, khởi động lại Metro (`npx expo start`).
4. **Laravel lắng nghe trên toàn bộ giao diện mạng** — mặc định `php artisan serve` chỉ bind `127.0.0.1` nên điện thoại không vào được. Từ thư mục `backend/`:
   ```bash
   php artisan serve --host=0.0.0.0 --port=8000
   ```
5. Trong `app/`: `npm start` (hoặc `npx expo start`). Trong terminal Expo, dùng chế độ **LAN** (phím `s` chuyển connection nếu cần) để QR trỏ tới IP máy dev.
6. Trên Android: cài [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) từ Play Store, mở app và **quét QR** hiện trong terminal (hoặc dùng Camera hệ thống rồi mở bằng Expo Go).
7. **Firewall / bảo mật:** nếu không tải được bundle hoặc không gọi được API, mở cổng Metro (thường 8081) và cổng Laravel (8000) cho mạng LAN trên máy dev.
8. **Không tải được bundle qua LAN** (AP isolation, mạng công ty, v.v.): `npx expo start --tunnel` để Metro qua tunnel (chậm hơn). Tunnel **không** thay thế việc điện thoại gọi Laravel: vẫn cần `EXPO_PUBLIC_API_URL` là URL mà điện thoại mở được — thường `http://<IP_LAN>:8000` khi điện thoại và máy dev **cùng Wi‑Fi** và backend chạy `--host=0.0.0.0`. Nếu điện thoại không cùng mạng với backend, phải expose API riêng (vd. ngrok, staging).

## Cấu hình trong repo

| Nguồn | Mô tả |
|--------|--------|
| `.env` / `.env.example` | `EXPO_PUBLIC_API_URL` (ưu tiên); không commit secret |
| `eas.json` | Profile EAS: `preview` → **APK** nội bộ; `production` → **AAB** (Play Store) |
| `app.json` → `expo.android.package` | Application ID Android (mặc định `com.story.reader`; đổi nếu trùng) |
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

## Build file APK (cài trực tiếp trên Android)

Dùng [EAS Build](https://docs.expo.dev/build/introduction/) trên cloud Expo (không cần Android Studio trên máy dev). File cấu hình: `eas.json` — profile **`preview`** xuất **APK** (`buildType: "apk"`), phù hợp cài tay / nội bộ.

1. Tạo tài khoản miễn phí tại [expo.dev](https://expo.dev) nếu chưa có.
2. Cài EAS CLI: `npm install -g eas-cli` hoặc gọi từng lần: `npx eas-cli@latest <lệnh>`.
3. Trong thư mục `app/`:
   ```bash
   cd app
   eas login
   ```
4. **Lần đầu** trong repo: `eas init` — chọn tạo project Expo mới (hoặc liên kết project có sẵn). Lệnh này thêm `extra.eas.projectId` vào `app.json` (nên commit giá trị đó).
5. **`EXPO_PUBLIC_API_URL` lúc build:** biến này được nhúng vào bundle lúc build. Với APK dùng ngoài máy dev, URL phải là backend **thật** (HTTPS staging/production, hoặc IP/domain mà điện thoại truy cập được), không phải `http://localhost:8000`. Cách đặt:
   - tạo file `.env` trong `app/` trước khi chạy `eas build`, **hoặc**
   - thêm `env` trong profile `preview` trong `eas.json` (vd. `"EXPO_PUBLIC_API_URL": "https://api.example.com"`), **hoặc**
   - dùng [EAS Secrets](https://docs.expo.dev/build-reference/variables/) / biến môi trường trên expo.dev.
6. Chạy build APK (cần đã `eas login` và `eas init` / project liên kết):
   ```bash
   npm run build:apk
   ```
   (tương đương `eas build --platform android --profile preview` — profile trong `eas.json` xuất **APK**.)
7. Đợi build xong trên [expo.dev](https://expo.dev) → mở trang build → **Download** file `.apk` → chép sang điện thoại và cài (có thể phải bật “Nguồn không xác định” trong cài đặt Android).

**Phiên bản Android:** mỗi lần gửi lên Play Store (hoặc một số kênh) cần tăng `versionCode` trong `app.json` → `expo.android.versionCode`. `expo.version` là chuỗi hiển thị (vd. `1.0.1`).

**Build APK trên máy (Android Studio + SDK):** `npx expo prebuild` tạo thư mục `android/`, rồi `./gradlew assembleRelease` trong `android/` — chỉ nên dùng khi bạn quen native toolchain; thư mục `android/` thường nằm trong `.gitignore` của repo này.

## Build / phát hành khác

- **Play Store:** `eas build --platform android --profile production` → file **AAB** (cấu hình trong `eas.json`).
- **Web tĩnh:** `npx expo export --platform web` (tuỳ `app.json` → `expo.web.output`).
