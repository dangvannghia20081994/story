function resolveBase(): string {
  const server = process.env.API_URL?.replace(/\/$/, "");
  const pub = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (typeof window === "undefined") {
    return server ?? pub ?? "";
  }
  return pub ?? "";
}

const base = resolveBase();

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
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
  created_at: string;
  updated_at: string;
  chapters_count?: number;
}

export interface CreateStoryData {
  title: string;
  slug?: string;
  description?: string;
  genre?: string;
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
