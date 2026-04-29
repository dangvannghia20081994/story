/** Khớp với key đã dùng trong `read/page.tsx` (slug làm khóa). */
export function readProgressStorageKey(storyKey: string): string {
  return `story-read:${storyKey}`;
}

export const READING_PROGRESS_EVENT = "story-reading-progress";

export type ReadingProgressDetail = {
  storyKey: string;
  chapterId: number;
  chapterSlug?: string | null;
};

export type SavedChapterRef = {
  id: number;
  slug?: string | null;
};

function parseStoredChapterRef(raw: string): SavedChapterRef | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("{")) {
    try {
      const o = JSON.parse(t) as { id?: unknown; slug?: unknown };
      const id = Number(o.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      const slug = o.slug;
      if (typeof slug === "string" && slug.trim() !== "") {
        return { id, slug: slug.trim() };
      }
      return { id };
    } catch {
      return null;
    }
  }
  const id = parseInt(t, 10);
  return Number.isFinite(id) && id > 0 ? { id } : null;
}

/** Đọc/ghi tiến độ chương (JSON `{ id, slug? }` hoặc số legacy). */
export function getSavedChapterRef(storyKey: string): SavedChapterRef | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(readProgressStorageKey(storyKey));
    if (raw == null || raw === "") return null;
    return parseStoredChapterRef(raw);
  } catch {
    return null;
  }
}

export function getSavedChapterId(storyKey: string): number | null {
  return getSavedChapterRef(storyKey)?.id ?? null;
}

export function setSavedChapterRef(storyKey: string, chapter: { id: number; slug?: string | null }): void {
  if (typeof window === "undefined") return;
  const id = chapter.id;
  if (!Number.isFinite(id) || id <= 0) return;
  const slug = typeof chapter.slug === "string" ? chapter.slug.trim() : "";
  try {
    const raw = slug !== "" ? JSON.stringify({ id, slug }) : JSON.stringify({ id });
    localStorage.setItem(readProgressStorageKey(storyKey), raw);
    window.dispatchEvent(
      new CustomEvent(READING_PROGRESS_EVENT, {
        detail: { storyKey, chapterId: id, chapterSlug: slug !== "" ? slug : null } satisfies ReadingProgressDetail,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function setSavedChapterId(storyKey: string, chapterId: number): void {
  setSavedChapterRef(storyKey, { id: chapterId });
}
