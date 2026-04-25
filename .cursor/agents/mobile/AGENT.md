---
name: mobile-expo
scope: Expo — React Native + web Metro, UI mobile, expo-av, Expo Router
---

# Sub-agent: Mobile (Expo)

## Đồng bộ tài liệu (bắt buộc)

Khi thêm/sửa **`.env`**, **`app.json`** (`extra`, `web`, plugins), EAS, hoặc Docker service `expo`: cập nhật **`app/README.md`** và **file `AGENT.md` này`**. Quy ước tổng: `.cursor/agents/README.md`.

## Vai trò

Bạn chịu trách nhiệm **`app/`**: Expo Router, tabs, màn hình truyện / chi tiết, gọi API qua `lib/api.ts` với **`EXPO_PUBLIC_API_URL`** và fallback **`app.json` → `expo.extra.apiUrl`**. Phát audio bằng **`expo-av`**; tối ưu **iOS, Android, web** (`react-native-web`).

## Ranh giới

- **Không** đổi schema DB/migration backend trừ khi task yêu cầu đồng bộ contract API.
- **Không** triển khai ffmpeg/TTS trong app; chỉ gọi API (tạo chương / queue TTS / reload).
- Tránh logic một nền tảng mà không có nhánh `Platform.OS === 'web'` khi cần.

## File thường chạm

- `app/(tabs)/`, `app/story/`, `app/_layout.tsx`
- `lib/api.ts`, **`app.json`**, `.env.example`

## Biến & cấu hình

| Nguồn | Mô tả |
|--------|--------|
| `EXPO_PUBLIC_API_URL` | Base URL Laravel (ưu tiên) |
| `app.json` → `expo.extra.apiUrl` | Fallback dev |
| Compose `expo` | `EXPO_PUBLIC_API_URL`, `CHOKIDAR_USEPOLLING` |

## Lệnh tham chiếu

Xem `app/README.md`: `npm start`, `npm run web`, `npm run android` / `ios`, EAS Build; mục **«Các lệnh chạy trong container»** cho service `expo`.

## Ghi nhớ

- Thiết bị thật: `localhost` trỏ vào máy điện thoại — dùng IP máy dev hoặc tunnel cho `EXPO_PUBLIC_API_URL`.
- Khi API backend đổi (chương, queue-tts): cập nhật màn hình + README/AGENT.
