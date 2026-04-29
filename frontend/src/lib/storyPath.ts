/** Slug dùng trong URL/API; fallback id nếu DB chưa có slug (dữ liệu cũ). */
export function storyKey(story: { id: number; slug?: string | null }): string {
  const s = story.slug;
  if (typeof s === "string" && s.trim() !== "") return s;
  return String(story.id);
}

/** Slug chương trong URL; fallback id nếu chưa có slug. */
export function chapterKey(chapter: { id: number; slug?: string | null }): string {
  const s = chapter.slug;
  if (typeof s === "string" && s.trim() !== "") return s.trim();
  return String(chapter.id);
}

export type ChapterLinkRef = { id: number; slug?: string | null };

/**
 * Chọn chương để build URL: tiến độ đọc chỉ lưu id — map sang bản ghi có `slug` nếu có trong `chapters`.
 * Chương không nằm trong danh sách (chưa tải trang) thì fallback `{ id }` (URL dạng số).
 */
export function chapterForStoryHref(
  savedChapterId: number | null,
  firstChapter: ChapterLinkRef,
  chapters: ChapterLinkRef[],
): ChapterLinkRef {
  if (savedChapterId == null) return firstChapter;
  const hit = chapters.find((c) => c.id === savedChapterId);
  return hit ?? { id: savedChapterId };
}

/** Trang truyện: `/{storyKey}` (rewrite → `/stories/...` trong next.config). */
export function storyDetailHref(story: { id: number; slug?: string | null }): string {
  return `/${encodeURIComponent(storyKey(story))}`;
}

/** Trang đọc: `/{storyKey}/{chapterKey}/read` (rewrite → `/stories/.../read`). */
export function storyReadHref(
  story: { id: number; slug?: string | null },
  chapter: number | { id: number; slug?: string | null },
): string {
  const sk = storyKey(story);
  const ch = typeof chapter === "number" ? { id: chapter } : chapter;
  const ck = chapterKey(ch);
  return `/${encodeURIComponent(sk)}/${encodeURIComponent(ck)}/read`;
}

/** Nghe TTS: `/{story}/{chapter}/listen` (rewrite → `/stories/.../listen`). */
export function storyListenHref(
  story: { id: number; slug?: string | null },
  chapter: number | { id: number; slug?: string | null },
): string {
  const sk = storyKey(story);
  const ch = typeof chapter === "number" ? { id: chapter } : chapter;
  const ck = chapterKey(ch);
  return `/${encodeURIComponent(sk)}/${encodeURIComponent(ck)}/listen`;
}

/** Nghe file audio: `/{story}/{chapter}/listen-audio` (rewrite → `/stories/.../listen-audio`). */
export function storyListenAudioHref(
  story: { id: number; slug?: string | null },
  chapter: number | { id: number; slug?: string | null },
): string {
  const sk = storyKey(story);
  const ch = typeof chapter === "number" ? { id: chapter } : chapter;
  const ck = chapterKey(ch);
  return `/${encodeURIComponent(sk)}/${encodeURIComponent(ck)}/listen-audio`;
}
