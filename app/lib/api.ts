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
  characters_count?: number;
  chapters?: Chapter[];
}

export interface Chapter {
  id: number;
  story_id?: number;
  title: string;
  content: string;
  audio_path: string | null;
  audio_url?: string | null;
  duration: number;
}

export interface CreateStoryData {
  title: string;
  slug?: string;
  description?: string;
  genre?: string;
  genres?: string[];
  first_chapter?: {
    title: string;
    content: string;
  };
}

export type PaginatedStories = {
  data: Story[];
};

export function chapterAudioUrl(c: Chapter | undefined | null): string | null {
  if (!c) return null;
  if (c.audio_url) return resolveMediaUrl(c.audio_url);
  if (c.audio_path?.startsWith("http")) return c.audio_path;
  return resolveMediaUrl(c.audio_path);
}

export async function createStory(data: CreateStoryData): Promise<Story> {
  return apiFetch<Story>("/api/stories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

