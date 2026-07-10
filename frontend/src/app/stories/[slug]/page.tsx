import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarLayout } from "@/components/layouts";
import { StoryAddChapterButton } from "@/app/stories/components/StoryAddChapterButton";
import { StoryChaptersBlock } from "@/app/stories/components/StoryChaptersBlock";
import { apiFetch } from "@/lib/api";
import { genreLabel } from "@/lib/genreLabels";
import { storyGenreSlugs } from "@/lib/storyGenres";
import { serialStatusBadgeClass, serialStatusLabel } from "@/lib/serialStatusLabels";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { StoryListenAudioPrimaryButton } from "@/app/stories/components/StoryListenAudioPrimaryButton";
import { StoryReadPrimaryButton } from "@/app/stories/components/StoryReadPrimaryButton";
import { StoryListenPrimaryButton } from "@/app/stories/components/StoryListenPrimaryButton";
import { storyCharactersHref } from "@/lib/storyPath";

type ChapterRow = {
  id: number;
  title: string;
  slug?: string | null;
  content: string;
  audio_single_path: string | null;
  audio_multiple_path: string | null;
  audio_single_url?: string | null;
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
  return resolvePlayableAudioUrl(c.audio_single_url, c.audio_multiple_path);
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
  const withAudioTotal = s.chapters_with_audio_total ?? chapters.filter((c) => chapterAudioUrl(c) || c.audio_single_path).length;
  const firstChapter = chapters[0];
  const chaptersForHref = chapters.map((c) => ({ id: c.id, slug: c.slug }));
  const shell = "paper-card";

  return (
    <SidebarLayout storyId={s.id} storyGenreSlugs={genreSlugs}>
      <div className="flex flex-col gap-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/stories"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-raised px-3 py-1.5 font-medium text-ink-soft transition hover:border-chusa/40 hover:text-chusa"
          >
            ← Danh sách truyện
          </Link>
          <span className="text-ink-faint">/</span>
          <span className="truncate text-ink-faint">{s.title}</span>
        </nav>

        <section className={`${shell} overflow-hidden`}>
          <div className="h-1 bg-gradient-to-r from-chusa via-chusa-deep to-ngoc" aria-hidden />
          <div className="flex flex-col gap-5 p-6 md:gap-6 md:p-8">
            {/* 1 — Tên truyện */}
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
              {s.title}
            </h1>
            {/* 2 — Thể loại + tình trạng */}
            <div className="flex flex-wrap items-center gap-2">
              {genreSlugs.map((gSlug) => {
                const lab = genreLabel(gSlug);
                return lab ? (
                  <span
                    key={gSlug}
                    className="rounded-full border border-chusa/25 bg-chusa/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-chusa"
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
              {chaptersTotal > 0 && firstChapter ? (
                <>
                  <StoryReadPrimaryButton storyKey={slug} firstChapter={firstChapter} chapters={chaptersForHref} />
                  <StoryListenPrimaryButton storyKey={slug} firstChapter={firstChapter} chapters={chaptersForHref} />
                  {withAudioTotal > 0 ? (
                    <StoryListenAudioPrimaryButton storyKey={slug} firstChapter={firstChapter} chapters={chaptersForHref} />
                  ) : null}
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
                <p className="max-w-2xl text-pretty font-serif text-sm leading-relaxed text-ink-soft md:text-base">
                  {s.description}
                </p>
              ) : (
                <p className="font-serif text-sm italic text-ink-faint">Chưa có mô tả ngắn cho truyện này.</p>
              )}
            </div>
          </div>
        </section>

        {/* 5 — Thông tin & danh sách chương */}
        {chaptersTotal > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              {typeof s.chapters_count === "number" ? (
                <>
                  <span className="font-medium text-ink">{s.chapters_count}</span> chương
                </>
              ) : (
                <>
                  <span className="font-medium text-ink">{chaptersTotal}</span> chương
                </>
              )}
              {typeof s.characters_count === "number" && s.characters_count > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    href={storyCharactersHref(slug)}
                    className="font-medium text-chusa underline-offset-2 hover:underline"
                  >
                    {s.characters_count} nhân vật
                  </Link>
                </>
              ) : null}
              {" "}
              ·{" "}
              <span className="font-medium text-ink">{withAudioTotal}</span> / {chaptersTotal}{" "}
              chương đã có file audio
            </p>
            <StoryChaptersBlock
              key={slug}
              storyKey={slug}
              initialChapters={chapters}
              initialChaptersTotal={chaptersTotal}
              shell={shell}
            />
          </div>
        ) : (
          <section className={`${shell} p-6 text-center`}>
            <p className="text-sm text-ink-soft">Truyện này chưa có chương.</p>
            <p className="mt-2 text-xs text-ink-faint">
              Dùng nút <span className="font-medium text-chusa">Thêm chương</span> phía trên để
              tạo chương đầu tiên.
            </p>
          </section>
        )}
      </div>
    </SidebarLayout>
  );
}
