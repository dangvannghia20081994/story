import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarLayout } from "@/components/layouts";
import { StoryDetailAudio } from "./StoryDetailAudio";
import { apiFetch } from "@/lib/api";
import { genreLabel } from "@/lib/genreLabels";
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
};

type StoryShowData = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  genre: string | null;
  serial_status?: string | null;
  chapters?: ChapterRow[];
  chapters_count?: number;
  characters_count?: number;
};

function chapterAudioUrl(c: ChapterRow): string | null {
  return resolvePlayableAudioUrl(c.audio_url, c.audio_path);
}

function audioBadgeClass(hasFile: boolean): string {
  return hasFile
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-200"
    : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300";
}

function audioStatusLabel(hasFile: boolean): string {
  return hasFile ? "Đã có file audio" : "Chưa có file";
}

async function loadStory(storyKey: string): Promise<{ story: StoryShowData; chapters: ChapterRow[] } | null> {
  try {
    const res = await apiFetch<{ data: StoryShowData }>(`/api/stories/${encodeURIComponent(storyKey)}`);
    const story = res.data;
    const chapters = [...(story.chapters ?? [])].sort((a, b) => a.id - b.id);
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

  const genre = genreLabel(s.genre);
  const serialLabel = serialStatusLabel(s.serial_status ?? undefined);
  const withAudio = chapters.filter((c) => chapterAudioUrl(c)).length;
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
                {genre ? (
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:border-indigo-800/80 dark:bg-indigo-950/60 dark:text-indigo-200">
                    {genre}
                  </span>
                ) : null}
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
              {chapters.length > 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{withAudio}</span> /{" "}
                  {chapters.length} chương đã có file audio.
                </p>
              ) : null}
            </div>
            {chapters.length > 0 ? (
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

        {chapters.length > 0 ? <StoryDetailAudio storyTitle={s.title} chapters={chapters} /> : null}

        {chapters.length > 0 ? (
          <section className={`${shell} p-5 md:p-6`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Danh sách chương
              </h2>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {chapters.length} chương
              </span>
            </div>
            <ul className="divide-y divide-zinc-200/90 overflow-hidden rounded-xl border border-zinc-200/80 dark:divide-zinc-800 dark:border-zinc-800">
              {chapters.map((chapter, index) => {
                const hasFile = Boolean(chapterAudioUrl(chapter));
                return (
                <li
                  key={chapter.id}
                  className="flex flex-col gap-3 bg-white/40 px-4 py-4 transition hover:bg-white/90 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/50"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-200">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{chapter.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${audioBadgeClass(hasFile)}`}
                        >
                          {audioStatusLabel(hasFile)}
                        </span>
                        {chapter.duration > 0 ? (
                          <span className="text-xs text-zinc-500 dark:text-zinc-500">
                            {Math.floor(chapter.duration / 60)} phút {chapter.duration % 60}s
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pl-2">
                    <Link
                      href={storyReadHref(s, chapter.id)}
                      className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-200"
                    >
                      Đọc chương
                    </Link>
                  </div>
                </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section className={`${shell} p-6 text-center`}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Truyện này chưa có chương.</p>
          </section>
        )}
      </div>
    </SidebarLayout>
  );
}
