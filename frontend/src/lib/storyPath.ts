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

/**
 * `read_navigation.prev/next` chỉ có id (và title…). Map sang chương trong TOC `chapters`
 * để có `slug` cho URL; không có trong danh sách thì giữ stub (URL fallback theo id).
 */
export function resolveChapterForHref(
  stub: { id: number; slug?: string | null } | null | undefined,
  chapters: { id: number; slug?: string | null }[],
): { id: number; slug?: string | null } | null {
  if (!stub?.id) return null;
  return chapters.find((c) => c.id === stub.id) ?? stub;
}

/** Trang truyện: `/{storyKey}` (rewrite → `/stories/...` trong next.config). */
export function storyDetailHref(story: { id: number; slug?: string | null }): string {
  return `/${encodeURIComponent(storyKey(story))}`;
}

/** Danh sách nhân vật theo truyện: `/{storyKey}/characters`. */
export function storyCharactersHref(story: { id: number; slug?: string | null }): string {
  return `/${encodeURIComponent(storyKey(story))}/characters`;
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
