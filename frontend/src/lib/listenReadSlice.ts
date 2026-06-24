/**
 * Listen: fetch read slice, merge prev/current/next, cache session (remount đổi `[chapterSlug]`).
 */

import { apiFetch } from "@/lib/api";

export type ListenChapterRow = {
  id: number;
  title: string;
  slug?: string | null;
  content: string;
  audio_multiple_path: string | null;
  audio_url?: string | null;
  duration: number;
  chapter_number?: number | null;
};

/** Láng giềng đọc: API có thể trả đủ trường như read_chapter (kể cả content). */
export type ListenReadNavNeighbor = {
  id: number;
  title: string;
  slug?: string | null;
  content?: string | null;
  audio_multiple_path?: string | null;
  audio_url?: string | null;
  duration?: number;
  chapter_number?: number | null;
} | null;

export type ListenReadNav = {
  chapter_index: number;
  chapters_total: number;
  prev: ListenReadNavNeighbor;
  next: ListenReadNavNeighbor;
};

export type ListenStoryShowRead = {
  id: number;
  title: string;
  slug?: string;
  read_chapter?: ListenChapterRow;
  read_navigation?: ListenReadNav;
};

function chapterReadOrder(a: ListenChapterRow, b: ListenChapterRow): number {
  const aN = a.chapter_number;
  const bN = b.chapter_number;
  const aMissing = aN == null || aN === undefined;
  const bMissing = bN == null || bN === undefined;
  if (aMissing && bMissing) return a.id - b.id;
  if (aMissing) return 1;
  if (bMissing) return -1;
  if (aN !== bN) return aN - bN;
  return a.id - b.id;
}

export function mergeListenChapterRows(prev: ListenChapterRow[], incoming: ListenChapterRow[]): ListenChapterRow[] {
  const map = new Map<number, ListenChapterRow>();
  for (const c of prev) {
    map.set(c.id, { ...c });
  }
  for (const c of incoming) {
    const existing = map.get(c.id);
    map.set(c.id, {
      ...(existing ?? {}),
      ...c,
      chapter_number: c.chapter_number ?? existing?.chapter_number,
      content: c.content && c.content.trim() !== "" ? c.content : (existing?.content ?? ""),
    });
  }
  return Array.from(map.values()).sort(chapterReadOrder);
}

function rowFromNavNeighbor(n: NonNullable<ListenReadNavNeighbor>): ListenChapterRow {
  return {
    id: n.id,
    title: n.title,
    slug: n.slug ?? null,
    content: typeof n.content === "string" ? n.content : "",
    audio_multiple_path: (n.audio_multiple_path ?? null) as string | null,
    audio_url: n.audio_url ?? null,
    duration: typeof n.duration === "number" ? n.duration : 0,
    chapter_number: n.chapter_number ?? null,
  };
}

export function applyListenReadSliceToRows(
  prevList: ListenChapterRow[],
  slice: ListenStoryShowRead,
): { chapters: ListenChapterRow[]; index: number } {
  const rc = slice.read_chapter;
  const nav = slice.read_navigation;
  if (!rc) throw new Error("Thiếu read_chapter");

  const stubs: ListenChapterRow[] = [];
  if (nav?.prev) stubs.push(rowFromNavNeighbor(nav.prev));
  if (nav?.next) stubs.push(rowFromNavNeighbor(nav.next));

  const merged = mergeListenChapterRows(prevList, [...stubs, { ...rc, content: rc.content ?? "" }]);
  const idx = merged.findIndex((c) => c.id === rc.id);
  return { chapters: merged, index: idx >= 0 ? idx : 0 };
}

export async function fetchListenReadSlice(storySlug: string, chapterId: number): Promise<ListenStoryShowRead> {
  const key = encodeURIComponent(storySlug);
  const res = await apiFetch<{ data: ListenStoryShowRead }>(`/api/stories/${key}?read_chapter=${chapterId}`);
  return res.data;
}

export type ListenSessionRouteKind = "tts" | "audio";

export type ListenSessionCacheEntry = {
  chapters: ListenChapterRow[];
  story: ListenStoryShowRead | null;
  readNav: ListenReadNav | null;
  tocLastPage: number;
  tocLoadedPage: number;
};

const sessionCache = new Map<string, ListenSessionCacheEntry>();

function listenSessionKey(kind: ListenSessionRouteKind, slug: string): string {
  return `${kind}:${slug.trim()}`;
}

let lastListenSessionRouteKey: string | null = null;

export function touchListenSessionRoute(kind: ListenSessionRouteKind, slug: string): void {
  const s = slug.trim();
  if (!s) return;
  const k = listenSessionKey(kind, s);
  if (lastListenSessionRouteKey !== null && lastListenSessionRouteKey !== k) {
    sessionCache.delete(lastListenSessionRouteKey);
  }
  lastListenSessionRouteKey = k;
}

export function readListenSessionCache(
  kind: ListenSessionRouteKind,
  slug: string,
): ListenSessionCacheEntry | undefined {
  const s = slug.trim();
  if (!s) return undefined;
  return sessionCache.get(listenSessionKey(kind, s));
}

export function writeListenSessionCache(
  kind: ListenSessionRouteKind,
  slug: string,
  entry: ListenSessionCacheEntry,
): void {
  const s = slug.trim();
  if (!s) return;
  sessionCache.set(listenSessionKey(kind, s), entry);
}

export function clearListenSessionCache(kind: ListenSessionRouteKind, slug: string): void {
  const s = slug.trim();
  if (!s) return;
  sessionCache.delete(listenSessionKey(kind, s));
}
