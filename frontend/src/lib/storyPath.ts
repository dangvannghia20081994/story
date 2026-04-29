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
 * Chương mục tiêu cho link: ưu tiên bản trong `chapters`, không có thì dùng `extraSlug` (từ localStorage),
 * cuối cùng `{ id }`.
 */
export function chapterForStoryHref(
  savedChapterId: number | null,
  firstChapter: ChapterLinkRef,
  chapters: ChapterLinkRef[],
  extraSlug?: string | null,
): ChapterLinkRef {
  if (savedChapterId == null) return firstChapter;
  const hit = chapters.find((c) => c.id === savedChapterId);
  if (hit) return hit;
  const slug = extraSlug?.trim();
  if (slug) return { id: savedChapterId, slug };
  return { id: savedChapterId };
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

/** Phần đầu URL truyện: slug route (`string`) hoặc object API (fallback id nếu không slug). */
function routeStorySegment(storyOrKey: { id: number; slug?: string | null } | string): string {
  if (typeof storyOrKey === "string") {
    const t = storyOrKey.trim();
    return t !== "" ? t : "";
  }
  return storyKey(storyOrKey);
}

/** Trang truyện: `/{storyKey}` (rewrite → `/stories/...` trong next.config). */
export function storyDetailHref(storyOrRouteKey: { id: number; slug?: string | null } | string): string {
  const sk = routeStorySegment(storyOrRouteKey);
  return `/${encodeURIComponent(sk)}`;
}

/** Danh sách nhân vật theo truyện: `/{storyKey}/characters`. */
export function storyCharactersHref(storyOrRouteKey: { id: number; slug?: string | null } | string): string {
  const sk = routeStorySegment(storyOrRouteKey);
  return `/${encodeURIComponent(sk)}/characters`;
}

/** Trang đọc: `/{storyKey}/{chapterKey}/read` (rewrite → `/stories/.../read`). */
export function storyReadHref(
  storyOrRouteKey: { id: number; slug?: string | null } | string,
  chapter: number | { id: number; slug?: string | null },
): string {
  const sk = routeStorySegment(storyOrRouteKey);
  const ch = typeof chapter === "number" ? { id: chapter } : chapter;
  const ck = chapterKey(ch);
  return `/${encodeURIComponent(sk)}/${encodeURIComponent(ck)}/read`;
}

/** Nghe TTS: `/{story}/{chapter}/listen` (rewrite → `/stories/.../listen`). */
export function storyListenHref(
  storyOrRouteKey: { id: number; slug?: string | null } | string,
  chapter: number | { id: number; slug?: string | null },
): string {
  const sk = routeStorySegment(storyOrRouteKey);
  const ch = typeof chapter === "number" ? { id: chapter } : chapter;
  const ck = chapterKey(ch);
  return `/${encodeURIComponent(sk)}/${encodeURIComponent(ck)}/listen`;
}

/** Nghe file audio: `/{story}/{chapter}/listen-audio` (rewrite → `/stories/.../listen-audio`). */
export function storyListenAudioHref(
  storyOrRouteKey: { id: number; slug?: string | null } | string,
  chapter: number | { id: number; slug?: string | null },
): string {
  const sk = routeStorySegment(storyOrRouteKey);
  const ch = typeof chapter === "number" ? { id: chapter } : chapter;
  const ck = chapterKey(ch);
  return `/${encodeURIComponent(sk)}/${encodeURIComponent(ck)}/listen-audio`;
}
