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

function characterInitial(name: string): string {
  const t = name.trim();
  if (t.length === 0) return "?";
  return t[0]?.toUpperCase() ?? "?";
}

async function loadStoryBrief(slug: string): Promise<StoryBrief | null> {
  try {
    const res = await apiFetch<{ data: StoryBrief }>(
      `/api/stories/${encodeURIComponent(slug)}?chapters_order=asc&chapters_full=0&chapters_limit=1&chapters_offset=0&chapters_omit_content=1`,
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
      <div className="flex flex-col gap-8 md:gap-10">
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

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
            Danh sách nhân vật
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{story.title}</p>
        </header>

        <section className="flex flex-col gap-4" aria-labelledby="character-list-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p id="character-list-heading" className="text-sm text-zinc-600 dark:text-zinc-400">
              {characters.length > 0
                ? `${characters.length} nhân vật trong truyện.`
                : "Chưa có nhân vật nào cho truyện này."}
            </p>
            {characters.length > 0 ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-indigo-200/90 bg-indigo-50 px-3 py-1 text-xs font-semibold tabular-nums text-indigo-800 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-200">
                {characters.length}
              </span>
            ) : null}
          </div>

          {characters.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {characters.map((c) => (
                <li key={c.id}>
                  <div
                    className={`${shell} flex gap-4 rounded-2xl border-zinc-200/90 bg-gradient-to-br from-white to-zinc-50/90 p-4 dark:border-zinc-800 dark:from-zinc-900/90 dark:to-zinc-950/90`}
                  >
                    <span
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-inner ring-1 ring-white/25 dark:ring-white/10"
                      aria-hidden
                    >
                      {characterInitial(c.name)}
                    </span>
                    <span className="min-w-0 flex-1 py-0.5">
                      <span className="block font-semibold text-zinc-900 dark:text-zinc-50">{c.name}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div
              className={`${shell} border-dashed border-zinc-300/90 bg-zinc-50/50 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/40`}
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Thêm nhân vật trong CMS tại mục <span className="font-medium text-zinc-800 dark:text-zinc-200">Nhân vật</span> của
                truyện.
              </p>
            </div>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
}
