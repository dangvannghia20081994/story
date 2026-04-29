import { apiFetch } from "@/lib/api";
import type { LexiconRow } from "@/lib/applyLexicons";

type PaginatedLexicons = {
  data: LexiconRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

/** Tải toàn bộ lexicon (nhiều trang nếu cần) — API backend đã cache Redis. */
export async function fetchAllLexiconRows(): Promise<LexiconRow[]> {
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
