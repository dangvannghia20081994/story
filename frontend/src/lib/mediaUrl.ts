/**
 * URL dùng cho thẻ <audio> / <source> — trình duyệt phải tải được file.
 *
 * API Laravel trả `audio_single_url` = APP_URL + /storage/... (có thể `http://backend:...` trong Docker,
 * hoặc chỉ `/storage/...`). Nếu để tương đối `/storage/...` trên nextjs:3000, request đi tới
 * **Next** (không có file) → "The element has no supported sources" — cần rewrite `/storage` →
 * backend trong `next.config.ts` và ưu tiên path `/storage/...` cùng origin.
 */

/**
 * Từ `audio_single_url` (tùy chọn) và `audio_multiple_path` (như cột DB: chapters/1.mp3) suy ra src phát được.
 */
export function resolvePlayableAudioUrl(
  audioUrl: string | null | undefined,
  audioPath: string | null | undefined,
): string | null {
  const u = (audioUrl ?? "").trim();
  const p = (audioPath ?? "").trim().replace(/^\/+/, "");

  if (u) {
    if (u.startsWith("http://") || u.startsWith("https://")) {
      try {
        const parsed = new URL(u);
        // `/storage/*` và `/api/*` đều được next.config rewrite → backend. Hạ về tương đối
        // (same-origin) để trình duyệt tải được (host nội bộ `backend:8000` không phân giải)
        // và giữ nguyên host khi validate signed URL (`/api/.../audio/stream`).
        if (
          parsed.pathname.startsWith("/storage/") ||
          parsed.pathname === "/storage" ||
          parsed.pathname.startsWith("/api/")
        ) {
          return `${parsed.pathname}${parsed.search}`;
        }
        return u;
      } catch {
        return null;
      }
    }
    if (u.startsWith("/")) {
      return u;
    }
  }

  if (p) {
    if (p.startsWith("http://") || p.startsWith("https://")) {
      return resolvePlayableAudioUrl(p, null);
    }
    if (p.startsWith("storage/")) {
      return `/${p}`;
    }
    return `/storage/${p}`;
  }

  return null;
}
