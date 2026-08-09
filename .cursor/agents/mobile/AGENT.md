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

## Từ ngữ trong response (bắt buộc)

Viết như kỹ sư báo cáo: từ trung tính, mô tả ĐÚNG dữ liệu. 5 nhóm phải tránh:

1. **Ẩn dụ / giật gân** — "đau nhất", "toang", "chết", "vỡ", "khủng (khiếp)", "cực gắt", "bùng nổ",
   "báo động đỏ", "điểm nóng", "thảm hoạ", "đỉnh", "cân hết", "ăn hành", "cháy máy", "gánh còng lưng".
2. **Ghép từ sượng / dịch máy** — "đắt xấp xỉ", "nhanh xấp xỉ", "rẻ bất thường" (viết "giá gần bằng…",
   "xấp xỉ <số>", "nhanh bất thường"); "một cách nhanh chóng", "điều này có nghĩa là", "hãy cùng đi sâu
   vào", "bức tranh toàn cảnh", "con số biết nói", "điểm sáng/gam màu xám".
3. **Phóng đại / marketing** — "hoàn hảo", "xuất sắc", "vượt trội", "đột phá", "siêu nhanh", "cực kỳ",
   "ấn tượng", "đáng kinh ngạc". Thay bằng SỐ ĐO cụ thể ("giảm 4.2s → 0.8s").
4. **Filler AI / cảm thán** — "Tuyệt vời!", "Chính xác!", "Câu hỏi hay", "Hy vọng điều này giúp ích",
   emoji ăn mừng (🎉✨🚀). Vào thẳng nội dung.
5. **Văn nói / teencode** — "tụi mình" (→ "chúng tôi"), "mấy file/mấy chỗ" (→ "các …"), "ngon lành",
   "xịn", "hơi bị", "ok luôn", "code chuối", "chuẩn cơm mẹ nấu".

Bảng thay thế ĐÃ CHỐT (dùng lại, không chế từ mới):

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

Tiêu đề bảng / nhãn cột / tên mục = danh từ mô tả đúng dữ liệu ("Ticket quá hạn lâu nhất", "Màn hình
nhiều lỗi nhất", "Top 5 theo số bug") — không cảm thán, không phóng đại, không emoji trang trí.
Giữ tiếng Anh cho thuật ngữ chuẩn ngành (`filesort`, `covering index`, `derived table`, `optimizer`,
tên lệnh/branch/commit); KHÔNG chèn tiếng Anh lửng giữa câu tiếng Việt ("shape" → "dạng câu query",
"drive/driver table" → "bảng dẫn").
