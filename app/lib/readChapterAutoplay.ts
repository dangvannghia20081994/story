/** Nối tiếp đọc TTS sang chương sau (ref không sống qua `router.replace` trên native). */

type Pending = { slug: string; chapterId: number };

let pending: Pending | null = null;

export function queueReadChapterAutoplay(slug: string, chapterId: number): void {
  pending = { slug, chapterId };
}

export function consumeReadChapterAutoplay(slug: string, chapterId: number): boolean {
  if (!pending || pending.slug !== slug || pending.chapterId !== chapterId) {
    return false;
  }
  pending = null;
  return true;
}

export function clearReadChapterAutoplay(): void {
  pending = null;
}
