import { apiFetch } from "@/lib/api";
import type { LexiconRow } from "@/lib/applyLexicons";

type PaginatedLexicons = {
  data: LexiconRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

/** Lexicon chung + riêng truyện (slug URL), nhiều trang nếu cần. */
export async function fetchLexiconRowsForStory(storySlug: string): Promise<LexiconRow[]> {
  const key = storySlug.trim();
  if (key === "") return [];
  const perPage = 100;
  let page = 1;
  const all: LexiconRow[] = [];
  const base = `/api/stories/${encodeURIComponent(key)}/lexicons`;
  for (;;) {
    const res = await apiFetch<PaginatedLexicons>(`${base}?per_page=${perPage}&page=${page}`);
    const chunk = Array.isArray(res.data) ? res.data : [];
    all.push(...chunk);
    const last = res.last_page ?? 1;
    if (page >= last) break;
    page += 1;
    if (page > 500) break;
  }
  return all;
}

/** Chỉ lexicon chung (không theo truyện) — dùng khi không có slug truyện. */
export async function fetchGlobalLexiconRows(): Promise<LexiconRow[]> {
  const perPage = 100;
  let page = 1;
  const all: LexiconRow[] = [];
  for (;;) {
    const res = await apiFetch<PaginatedLexicons>(`/api/lexicons?per_page=${perPage}&page=${page}`);
    const chunk = Array.isArray(res.data) ? res.data : [];
    all.push(...chunk);
    const last = res.last_page ?? 1;
    if (page >= last) break;
    page += 1;
    if (page > 500) break;
  }
  return all;
}
