import Constants from "expo-constants";

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

/** Tránh `.../api` + path `/api/...` → `/api/api/...`. */
function normalizeApiBase(base: string): string {
  let b = stripTrailingSlash(base);
  if (b.endsWith("/api")) {
    b = stripTrailingSlash(b.slice(0, -4));
  }
  return b;
}

export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  return normalizeApiBase(stripTrailingSlash(fromEnv ?? fromExtra ?? "http://localhost:8000"));
}

/** URL tuyệt đối cho expo-av khi API trả đường dẫn `/storage/...`. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (url == null || url === "") return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${apiBaseUrl()}${url}`;
  return url;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${apiBaseUrl()}${p}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function parseApiErrorMessage(raw: string): string {
  try {
    const j = JSON.parse(raw) as { message?: string };
    if (typeof j.message === "string" && j.message.trim() !== "") {
      return j.message;
    }
  } catch {
    /* not JSON */
  }
  return raw || "Lỗi không xác định";
}

export interface Story {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  genre?: string | null;
  genres?: string[] | null;
  created_at: string;
  updated_at: string;
  chapters_count?: number;
  chapters_total?: number;
  chapters_with_audio_total?: number;
  characters_count?: number;
  chapters?: Chapter[];
}

export interface ContentSegment {
  speaker: string;
  text: string;
  character_id?: number | null;
}

export interface Chapter {
  id: number;
  story_id?: number;
  title: string;
  content: string;
  content_segments?: ContentSegment[] | null;
  audio_multiple_path: string | null;
  audio_url?: string | null;
  duration: number;
  chapter_number?: number | null;
}

/** Lân cận từ `read_navigation` (API `read_chapter`). */
export type ReadNavigationNeighbor = {
  id: number;
  title: string;
  duration?: number;
  audio_url?: string | null;
};

export type StoryReadNavigation = {
  chapter_index: number;
  chapters_total: number;
  prev: ReadNavigationNeighbor | null;
  next: ReadNavigationNeighbor | null;
};

/** Phản hồi phân trang Laravel (`StoryController@index`). */
export type PaginatedStories = {
  data: Story[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  next_page_url: string | null;
  prev_page_url: string | null;
};

export function chapterAudioUrl(c: Chapter | undefined | null): string | null {
  if (!c) return null;
  if (c.audio_url) return resolveMediaUrl(c.audio_url);
  if (c.audio_multiple_path?.startsWith("http")) return c.audio_multiple_path;
  return resolveMediaUrl(c.audio_multiple_path);
}


