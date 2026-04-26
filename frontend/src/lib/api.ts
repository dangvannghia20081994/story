function stripTrailingSlash(s: string | undefined): string {
  return s?.replace(/\/$/, "") ?? "";
}

/** Tránh `.../api` + path `/api/...` → `/api/api/...` khi cấu hình nhầm thêm `/api`. */
function normalizeApiBase(base: string): string {
  let b = stripTrailingSlash(base);
  if (b.endsWith("/api")) {
    b = b.slice(0, -4);
    b = stripTrailingSlash(b);
  }
  return b;
}

/** Base URL tuyệt đối cho fetch (Node bắt buộc). Trình duyệt có thể dùng '' + đường dẫn tương đối (rewrite /api trong next.config). */
function resolveBase(): string {
  const server = stripTrailingSlash(process.env.API_URL);
  const pub = stripTrailingSlash(process.env.NEXT_PUBLIC_API_URL);

  if (typeof window !== "undefined") {
    return pub;
  }

  if (server !== "") return server;
  if (pub !== "") return pub;

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8000";
  }

  throw new Error(
    "Thiếu API_URL hoặc NEXT_PUBLIC_API_URL — SSR không gọi được Laravel (xem frontend/README.md).",
  );
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const raw = resolveBase();
  const base = raw !== "" ? normalizeApiBase(raw) : "";
  const url = base !== "" ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path;

  const res = await fetch(url, {
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

// Story types
export interface Story {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  genre: string | null;
  serial_status?: string;
  created_at: string;
  updated_at: string;
  chapters_count?: number;
}

export interface CreateStoryData {
  title: string;
  slug?: string;
  description?: string;
  genre?: string;
  serial_status?: string;
  first_chapter?: {
    title: string;
    content: string;
  };
}

export async function createStory(data: CreateStoryData): Promise<Story> {
  return apiFetch<Story>("/api/stories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
