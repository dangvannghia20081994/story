/** Khớp với key đã dùng trong `read/page.tsx` (slug làm khóa). */
export function readProgressStorageKey(storyKey: string): string {
  return `story-read:${storyKey}`;
}

export const READING_PROGRESS_EVENT = "story-reading-progress";

export type ReadingProgressDetail = {
  storyKey: string;
  chapterId: number;
};

export function getSavedChapterId(storyKey: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(readProgressStorageKey(storyKey));
    if (raw == null || raw === "") return null;
    const id = parseInt(raw, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function setSavedChapterId(storyKey: string, chapterId: number): void {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(chapterId) || chapterId <= 0) return;
  try {
    localStorage.setItem(readProgressStorageKey(storyKey), String(chapterId));
    window.dispatchEvent(
      new CustomEvent(READING_PROGRESS_EVENT, {
        detail: { storyKey, chapterId } satisfies ReadingProgressDetail,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
