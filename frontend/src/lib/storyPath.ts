/** Slug dùng trong URL/API; fallback id nếu DB chưa có slug (dữ liệu cũ). */
export function storyKey(story: { id: number; slug?: string | null }): string {
  const s = story.slug;
  if (typeof s === "string" && s.trim() !== "") return s;
  return String(story.id);
}

export function storyDetailHref(story: { id: number; slug?: string | null }): string {
  return `/stories/${encodeURIComponent(storyKey(story))}`;
}

export function storyReadHref(story: { id: number; slug?: string | null }, chapterId?: number): string {
  const base = `${storyDetailHref(story)}/read`;
  if (chapterId == null) return base;
  return `${base}?chapter=${chapterId}`;
}

export function storyListenHref(story: { id: number; slug?: string | null }, chapterId?: number): string {
  const base = `${storyDetailHref(story)}/listen`;
  if (chapterId == null) return base;
  return `${base}?chapter=${chapterId}`;
}

/** Nghe bằng file audio (AudioPlayer). TODO: có thể giới hạn tài khoản trả phí. */
export function storyListenAudioHref(story: { id: number; slug?: string | null }, chapterId?: number): string {
  const base = `${storyDetailHref(story)}/listen-audio`;
  if (chapterId == null) return base;
  return `${base}?chapter=${chapterId}`;
}
