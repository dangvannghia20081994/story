import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarLayout } from "@/components/layouts";
import { StoryChaptersBlock } from "./StoryChaptersBlock";
import { apiFetch } from "@/lib/api";
import { genreLabel } from "@/lib/genreLabels";
import { storyGenreSlugs } from "@/lib/storyGenres";
import { serialStatusBadgeClass, serialStatusLabel } from "@/lib/serialStatusLabels";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { storyReadHref } from "@/lib/storyPath";

type ChapterRow = {
  id: number;
  title: string;
  content: string;
  audio_path: string | null;
  audio_url?: string | null;
  duration: number;
  created_at?: string;
  updated_at?: string;
};

type StoryShowData = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  genre?: string | null;
  genres?: string[] | null;
  serial_status?: string | null;
  chapters?: ChapterRow[];
  chapters_count?: number;
  chapters_total?: number;
  chapters_with_audio_total?: number;
  characters_count?: number;
};

function chapterAudioUrl(c: ChapterRow): string | null {
  return resolvePlayableAudioUrl(c.audio_url, c.audio_path);
}

async function loadStory(storyKey: string): Promise<{ story: StoryShowData; chapters: ChapterRow[] } | null> {
  try {
    const res = await apiFetch<{ data: StoryShowData }>(
      `/api/stories/${encodeURIComponent(storyKey)}?chapters_order=asc&chapters_full=0`,
    );
    const story = res.data;
    const chapters = [...(story.chapters ?? [])];
    return { story, chapters };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadStory(slug);
  if (!loaded) {
    return { title: "Truyện" };
  }
  return { title: loaded.story.title };
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = await loadStory(slug);
  if (!loaded) {
    notFound();
  }
  const { story: s, chapters } = loaded;

  const genreSlugs = storyGenreSlugs(s);
  const serialLabel = serialStatusLabel(s.serial_status ?? undefined);
  const chaptersTotal = s.chapters_total ?? chapters.length;
  const withAudioTotal = s.chapters_with_audio_total ?? chapters.filter((c) => chapterAudioUrl(c)).length;
  const shell =
    "rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75";

  return (
    <SidebarLayout storyId={s.id}>
      <div className="flex flex-col gap-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/stories"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white/80 px-3 py-1.5 font-medium text-zinc-600 transition hover:border-indigo-200 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:text-indigo-300"
          >
            ← Danh sách truyện
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <span className="truncate text-zinc-500 dark:text-zinc-500">{s.title}</span>
        </nav>

        <section className={`${shell} overflow-hidden`}>
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500" aria-hidden />
          <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between md:p-8">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {genreSlugs.map((slug) => {
                  const lab = genreLabel(slug);
                  return lab ? (
                    <span
                      key={slug}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:border-indigo-800/80 dark:bg-indigo-950/60 dark:text-indigo-200"
                    >
                      {lab}
                    </span>
                  ) : null;
                })}
                {serialLabel ? (
                  <span
                    className={`rounded-full border px-3 py-0.5 text-xs font-semibold tracking-wide ${serialStatusBadgeClass(s.serial_status ?? undefined)}`}
                  >
                    {serialLabel}
                  </span>
                ) : null}
                {typeof s.chapters_count === "number" ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                    {s.chapters_count} chương
                  </span>
                ) : null}
                {typeof s.characters_count === "number" && s.characters_count > 0 ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                    {s.characters_count} nhân vật
                  </span>
                ) : null}
              </div>
              <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
                {s.title}
              </h1>
              {s.description ? (
                <p className="max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-base">
                  {s.description}
                </p>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  Chưa có mô tả ngắn cho truyện này.
                </p>
              )}
              {chaptersTotal > 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{withAudioTotal}</span> /{" "}
                  {chaptersTotal} chương đã có file audio.
                </p>
              ) : null}
            </div>
            {chaptersTotal > 0 ? (
              <div className="shrink-0 md:pt-1">
                <Link
                  href={storyReadHref(s)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:bg-indigo-500 md:w-auto"
                >
                  <span aria-hidden>📖</span>
                  Đọc truyện
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        {chaptersTotal > 0 ? (
          <StoryChaptersBlock
            key={slug}
            storyKey={slug}
            story={s}
            initialChapters={chapters}
            initialChaptersTotal={chaptersTotal}
            shell={shell}
          />
        ) : (
          <section className={`${shell} p-6 text-center`}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Truyện này chưa có chương.</p>
          </section>
        )}
      </div>
    </SidebarLayout>
  );
}
