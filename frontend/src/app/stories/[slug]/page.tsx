import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarLayout } from "@/components/layouts";
import { StoryAddChapterButton } from "./StoryAddChapterButton";
import { StoryChaptersBlock } from "./StoryChaptersBlock";
import { apiFetch } from "@/lib/api";
import { genreLabel } from "@/lib/genreLabels";
import { storyGenreSlugs } from "@/lib/storyGenres";
import { serialStatusBadgeClass, serialStatusLabel } from "@/lib/serialStatusLabels";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { StoryReadPrimaryButton } from "./StoryReadPrimaryButton";
import { StoryListenPrimaryButton } from "./StoryListenPrimaryButton";

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
      `/api/stories/${encodeURIComponent(storyKey)}?chapters_order=asc&chapters_full=0&chapters_limit=25&chapters_offset=0&chapters_omit_content=1`,
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
          <div className="flex flex-col gap-5 p-6 md:gap-6 md:p-8">
            {/* 1 — Tên truyện */}
            <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
              {s.title}
            </h1>
            {/* 2 — Thể loại + tình trạng */}
            <div className="flex flex-wrap items-center gap-2">
              {genreSlugs.map((gSlug) => {
                const lab = genreLabel(gSlug);
                return lab ? (
                  <span
                    key={gSlug}
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
            </div>
            {/* 3 — Đọc truyện / Đọc tiếp (+ nghe, thêm chương) */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
              {chaptersTotal > 0 ? (
                <>
                  <StoryReadPrimaryButton storyKey={slug} story={s} />
                  <StoryListenPrimaryButton storyKey={slug} story={s} />
                </>
              ) : null}
              <StoryAddChapterButton
                storyKey={slug}
                storyTitle={s.title}
                variant={chaptersTotal > 0 ? "secondary" : "primary"}
              />
            </div>
            {/* 4 — Mô tả */}
            <div className="min-w-0">
              {s.description ? (
                <p className="max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-base">
                  {s.description}
                </p>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-500">Chưa có mô tả ngắn cho truyện này.</p>
              )}
            </div>
          </div>
        </section>

        {/* 5 — Thông tin & danh sách chương */}
        {chaptersTotal > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {typeof s.chapters_count === "number" ? (
                <>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.chapters_count}</span> chương
                </>
              ) : (
                <>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{chaptersTotal}</span> chương
                </>
              )}
              {typeof s.characters_count === "number" && s.characters_count > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.characters_count}</span> nhân vật
                </>
              ) : null}
              {" "}
              ·{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{withAudioTotal}</span> / {chaptersTotal}{" "}
              chương đã có file audio
            </p>
            <StoryChaptersBlock
              key={slug}
              storyKey={slug}
              story={s}
              initialChapters={chapters}
              initialChaptersTotal={chaptersTotal}
              shell={shell}
            />
          </div>
        ) : (
          <section className={`${shell} p-6 text-center`}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Truyện này chưa có chương.</p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
              Dùng nút <span className="font-medium text-indigo-600 dark:text-indigo-400">Thêm chương</span> phía trên để
              tạo chương đầu tiên.
            </p>
          </section>
        )}
      </div>
    </SidebarLayout>
  );
}
