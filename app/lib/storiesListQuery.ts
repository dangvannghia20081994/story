/**
 * Query GET /api/stories (public) — cùng contract với `frontend/src/lib/storiesListQuery.ts` / {@see ListStoriesRequest}.
 */
export type PublicStoriesListSort = "created_desc" | "created_asc";

export function buildPublicStoriesApiPath(
  page: number,
  opts: {
    q: string;
    perPage?: number;
    sort?: PublicStoriesListSort;
    serial_status?: "" | "ongoing" | "completed";
  },
): string {
  const per = Math.min(100, Math.max(1, opts.perPage ?? 20));
  const p = new URLSearchParams({
    page: String(page),
    per_page: String(per),
    sort: opts.sort ?? "created_desc",
  });
  const qt = opts.q.trim().slice(0, 200);
  if (qt !== "") p.set("q", qt);
  if (opts.serial_status === "ongoing" || opts.serial_status === "completed") {
    p.set("serial_status", opts.serial_status);
  }
  return `/api/stories?${p.toString()}`;
}
