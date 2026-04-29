import { STORY_GENRE_SLUGS, type StoryGenreSlug } from "@/lib/genreLabels";
import { STORIES_LIST_PER_PAGE } from "@/lib/storiesListConfig";

export type StoriesListSort = "created_desc" | "created_asc";

export type StoriesListFilters = {
  q: string;
  genres: StoryGenreSlug[];
  serial_status: "" | "ongoing" | "completed";
  has_audio: "" | "yes" | "no";
  sort: StoriesListSort;
};

export const DEFAULT_STORIES_LIST_FILTERS: StoriesListFilters = {
  q: "",
  genres: [],
  serial_status: "",
  has_audio: "",
  sort: "created_desc",
};

const VALID_GENRES = new Set<string>(STORY_GENRE_SLUGS);

function normalizeGenreSlug(s: string): StoryGenreSlug | null {
  const t = s.trim();
  if (t === "" || !VALID_GENRES.has(t)) return null;
  return t as StoryGenreSlug;
}

/** Đọc query từ URL (App Router searchParams). */
export function parseStoriesListSearchParams(
  raw: Record<string, string | string[] | undefined>,
): { page: number; filters: StoriesListFilters } {
  const pageRaw = typeof raw.page === "string" ? raw.page : Array.isArray(raw.page) ? raw.page[0] : undefined;
  const p = parseInt(pageRaw ?? "1", 10);
  const page = Number.isFinite(p) && p >= 1 ? p : 1;

  const qRaw = typeof raw.q === "string" ? raw.q : Array.isArray(raw.q) ? raw.q[0] : "";
  const q = qRaw.trim().slice(0, 200);

  const genresRaw = raw.genres;
  const genreParts: string[] = [];
  if (typeof genresRaw === "string") {
    genreParts.push(...genresRaw.split(","));
  } else if (Array.isArray(genresRaw)) {
    for (const x of genresRaw) {
      if (typeof x === "string") genreParts.push(...x.split(","));
    }
  }
  const genres: StoryGenreSlug[] = [];
  const seen = new Set<string>();
  for (const part of genreParts) {
    const g = normalizeGenreSlug(part);
    if (g && !seen.has(g)) {
      seen.add(g);
      genres.push(g);
    }
  }

  const serialRaw =
    typeof raw.serial_status === "string" ? raw.serial_status : Array.isArray(raw.serial_status) ? raw.serial_status[0] : "";
  const serial_status =
    serialRaw === "ongoing" || serialRaw === "completed" ? serialRaw : ("" as StoriesListFilters["serial_status"]);

  const audioRaw =
    typeof raw.has_audio === "string" ? raw.has_audio : Array.isArray(raw.has_audio) ? raw.has_audio[0] : "";
  const has_audio = audioRaw === "yes" || audioRaw === "no" ? audioRaw : ("" as StoriesListFilters["has_audio"]);

  const sortRaw = typeof raw.sort === "string" ? raw.sort : Array.isArray(raw.sort) ? raw.sort[0] : "";
  const sort: StoriesListSort = sortRaw === "created_asc" ? "created_asc" : "created_desc";

  return {
    page,
    filters: { q, genres, serial_status, has_audio, sort },
  };
}

/** Query string cho `/stories` (frontend), chỉ gồm tham số khác mặc định. */
export function buildStoriesListHref(page: number, filters: StoriesListFilters): string {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (filters.q.trim() !== "") p.set("q", filters.q.trim());
  if (filters.genres.length > 0) p.set("genres", filters.genres.join(","));
  if (filters.serial_status !== "") p.set("serial_status", filters.serial_status);
  if (filters.has_audio !== "") p.set("has_audio", filters.has_audio);
  if (filters.sort !== DEFAULT_STORIES_LIST_FILTERS.sort) p.set("sort", filters.sort);
  const s = p.toString();
  return s ? `/stories?${s}` : "/stories";
}

/** Query cho `GET /api/stories` (SSR + client). */
export function buildStoriesApiQuery(page: number, filters: StoriesListFilters): string {
  const p = new URLSearchParams({
    page: String(page),
    per_page: String(STORIES_LIST_PER_PAGE),
    sort: filters.sort,
  });
  if (filters.q.trim() !== "") p.set("q", filters.q.trim());
  if (filters.genres.length > 0) p.set("genres", filters.genres.join(","));
  if (filters.serial_status !== "") p.set("serial_status", filters.serial_status);
  if (filters.has_audio !== "") p.set("has_audio", filters.has_audio);
  return `/api/stories?${p.toString()}`;
}
