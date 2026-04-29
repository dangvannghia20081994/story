import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SidebarLayout } from "@/components/layouts";
import { apiFetch } from "@/lib/api";
import { storyGenreSlugs } from "@/lib/storyGenres";
import { storyDetailHref } from "@/lib/storyPath";

type StoryBrief = {
  id: number;
  title: string;
  slug: string;
  genres?: string[] | null;
  genre?: string | null;
  characters_count?: number;
};

type CharacterRow = {
  id: number;
  story_id: number;
  name: string;
};

type CharactersPageJson = {
  data: CharacterRow[];
  current_page?: number;
  last_page?: number;
};

const shell =
  "rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75";

async function loadStoryBrief(slug: string): Promise<StoryBrief | null> {
  try {
    const res = await apiFetch<{ data: StoryBrief }>(
      `/api/stories/${encodeURIComponent(slug)}?chapters_order=asc&chapters_full=0&chapters_limit=0&chapters_offset=0&chapters_omit_content=1`,
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

async function loadAllCharacters(storyKey: string): Promise<CharacterRow[]> {
  const key = encodeURIComponent(storyKey);
  const all: CharacterRow[] = [];
  let page = 1;
  for (;;) {
    const res = await apiFetch<CharactersPageJson>(
      `/api/stories/${key}/characters?per_page=100&page=${page}`,
    );
    const chunk = Array.isArray(res.data) ? res.data : [];
    all.push(...chunk);
    const last = res.last_page ?? 1;
    if (page >= last) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = await loadStoryBrief(slug);
  if (!story) {
    return { title: "Nhân vật" };
  }
  return { title: `Nhân vật — ${story.title}` };
}

export default async function StoryCharactersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await loadStoryBrief(slug);
  if (!story) {
    notFound();
  }

  const characters = await loadAllCharacters(slug);
  const genreSlugs = storyGenreSlugs(story);

  return (
    <SidebarLayout storyId={story.id} storyGenreSlugs={genreSlugs}>
      <div className="flex flex-col gap-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/stories"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white/80 px-3 py-1.5 font-medium text-zinc-600 transition hover:border-indigo-200 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:text-indigo-300"
          >
            ← Danh sách truyện
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <Link
            href={storyDetailHref(story)}
            className="truncate font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300"
          >
            {story.title}
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <span className="truncate text-zinc-500 dark:text-zinc-500">Nhân vật</span>
        </nav>

        <header className={`${shell} p-6 md:p-8`}>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
            Nhân vật trong truyện
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {characters.length > 0
              ? `${characters.length} nhân vật — bấm tên để xem chi tiết (trang Thành viên).`
              : "Truyện này chưa có nhân vật trong API — có thể thêm từ CMS (Truyện → Nhân vật)."}
          </p>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
            Danh sách chung toàn hệ thống:{" "}
            <Link href="/members" className="font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300">
              Thành viên
            </Link>
            .
          </p>
        </header>

        {characters.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/members/${c.id}?story=${c.story_id}`}
                  className={`${shell} flex flex-col gap-1 p-4 transition hover:border-indigo-200/90 hover:shadow-md dark:hover:border-indigo-800/60`}
                >
                  <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{c.name}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Chi tiết →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <section className={`${shell} p-8 text-center`}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có mục nhân vật nào cho truyện này.</p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
              Bạn có thể thêm trong CMS tại mục <span className="font-medium">Nhân vật</span> của truyện.
            </p>
          </section>
        )}
      </div>
    </SidebarLayout>
  );
}
