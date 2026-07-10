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
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-raised px-3 py-1.5 font-medium text-ink-soft transition hover:border-chusa/40 hover:text-chusa"
          >
            ← Danh sách truyện
          </Link>
          <span className="text-ink-faint">/</span>
          <Link
            href={storyDetailHref(story)}
            className="truncate font-medium text-chusa underline-offset-2 hover:underline"
          >
            {story.title}
          </Link>
          <span className="text-ink-faint">/</span>
          <span className="truncate text-ink-faint">Nhân vật</span>
        </nav>

        <header className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
            Danh sách nhân vật
          </h1>
          <p className="text-sm text-ink-faint">{story.title}</p>
        </header>

        <section className="flex flex-col gap-4" aria-labelledby="character-list-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p id="character-list-heading" className="text-sm text-ink-soft">
              {characters.length > 0
                ? `${characters.length} nhân vật trong truyện.`
                : "Chưa có nhân vật nào cho truyện này."}
            </p>
            {characters.length > 0 ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-chusa/25 bg-chusa/10 px-3 py-1 text-xs font-semibold tabular-nums text-chusa">
                {characters.length}
              </span>
            ) : null}
          </div>

          {characters.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {characters.map((c) => (
                <li key={c.id}>
                  <div className="paper-card flex gap-4 p-4">
                    <span
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-chusa font-display text-lg font-bold text-[#f6ede0] shadow-inner"
                      aria-hidden
                    >
                      {characterInitial(c.name)}
                    </span>
                    <span className="min-w-0 flex-1 py-0.5">
                      <span className="block font-display font-semibold text-ink">{c.name}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="paper-card border-dashed border-line bg-paper-inset p-10 text-center">
              <p className="font-serif text-sm italic text-ink-faint">
                Thêm nhân vật trong CMS tại mục <span className="font-medium text-ink not-italic">Nhân vật</span> của
                truyện.
              </p>
            </div>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
}
