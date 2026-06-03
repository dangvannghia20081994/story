---
name: mobile-expo
scope: Expo — React Native + web Metro, UI mobile, expo-av, expo-speech, Expo Router
---

# Sub-agent: Mobile (Expo)

> Đồng bộ: `.cursor/agents/mobile-expo.md` · `.claude/agents/mobile-expo.md`

## Đồng bộ tài liệu (bắt buộc)

Khi sửa **`.env`**, **`app.json`**, EAS, Docker `expo`: cập nhật **`app/README.md`**, file này, **`mobile-expo.md`**.

## Vai trò

`app/` — Expo Router, tabs, màn truyện/chương, `lib/api.ts`, `expo-av` + `expo-speech`.

## Ranh giới

- **Không** đổi schema DB trừ khi sync contract API.
- **Không** ffmpeg/TTS server trong app.
- `Platform.OS === 'web'` khi logic khác web/native.

## File thường chạm

- `app/(tabs)/`, `app/story/`, `app/_layout.tsx`
- `lib/api.ts`, `lib/storiesListQuery.ts`, `lib/webTitle.ts`
- `constants/storyUi.ts`, `app.json`, `eas.json`, `plugins/`

## Biến & config

| Nguồn | Mô tả |
|--------|--------|
| `EXPO_PUBLIC_API_URL` | Base API (ưu tiên) |
| `app.json` → `expo.extra.apiUrl` | Fallback dev |
| Compose `expo` | 8090→8081, `CHOKIDAR_USEPOLLING`; không set `CI` |

## Lệnh

```bash
npm install && npm start && npm run web
npm run build:apk / npm run build:aab
docker compose up expo
```

## Ghi nhớ

- Điện thoại thật: IP LAN, không `localhost`
- Tab Truyện: search `q` + debounce
- Web title: `lib/webTitle.ts`
