import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QueueChapterTtsButton } from "./QueueChapterTtsButton";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SidebarLayout } from "@/components/layouts";
import { apiFetch } from "@/lib/api";
import { genreLabel } from "@/lib/genreLabels";
import { storyKey, storyReadHref } from "@/lib/storyPath";

type ChapterRow = {
  id: number;
  title: string;
  content: string;
  audio_path: string | null;
  audio_url?: string | null;
  status: string;
  duration: number;
  error_message?: string | null;
};

type StoryShowData = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  genre: string | null;
  chapters?: ChapterRow[];
  chapters_count?: number;
  characters_count?: number;
};

function chapterAudioUrl(c: ChapterRow): string | null {
  return c.audio_url ?? (c.audio_path ? c.audio_path : null);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "processing":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200";
    case "failed":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900/80 dark:bg-red-950/40 dark:text-red-200";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300";
  }
}

function statusLabel(status: string): string {
  if (status === "completed") return "Hoàn thành";
  if (status === "processing") return "Đang xử lý";
  if (status === "failed") return "Lỗi";
  return "Chờ render";
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

  const currentChapter =
    chapters.find((c) => chapterAudioUrl(c) && c.status === "completed") ?? chapters[0];
  const audioSrc = currentChapter != null ? chapterAudioUrl(currentChapter) : null;

  const genre = genreLabel(s.genre);
  const withAudio = chapters.filter((c) => chapterAudioUrl(c)).length;
  const failedChapter = chapters.find((c) => c.status === "failed" && c.error_message);

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
              {failedChapter?.error_message ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                  {failedChapter.error_message}
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

        {audioSrc ? (
          <AudioPlayer
            layout="detail"
            src={audioSrc}
            storyTitle={s.title}
            title={currentChapter?.title ?? s.title}
            initialChapterId={currentChapter?.id ?? null}
            chapters={chapters.map((c) => ({
              id: c.id,
              title: c.title,
              audio_url: chapterAudioUrl(c),
            }))}
          />
        ) : (
          <section className={`${shell} overflow-hidden`}>
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 opacity-70" aria-hidden />
            <div className="px-5 py-10 text-center md:px-8 md:py-12">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-2xl shadow-inner dark:from-indigo-950/80 dark:to-violet-950/60">
                <span aria-hidden>🎧</span>
              </div>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                Nghe audio
              </h2>
              <p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Chưa có audio</p>
              <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
                Dùng nút <span className="font-medium text-zinc-700 dark:text-zinc-400">Xếp hàng TTS</span> ở từng
                chương chưa có audio bên dưới. Sau vài phút, tải lại trang để nghe thử.
              </p>
            </div>
          </section>
        )}

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
              {chapters.map((chapter, index) => (
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
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(chapter.status)}`}
                        >
                          {statusLabel(chapter.status)}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">
                          {chapter.duration > 0
                            ? `${Math.floor(chapter.duration / 60)} phút ${chapter.duration % 60}s`
                            : chapterAudioUrl(chapter)
                              ? "Đã có file"
                              : "Chưa có audio"}
                        </span>
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
                    <QueueChapterTtsButton storySlug={storyKey(s)} chapterId={chapter.id} status={chapter.status} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className={`${shell} p-6 text-center`}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Truyện này chưa có chương.</p>
            <p className="mt-2 text-xs text-zinc-500">Thêm chương qua CMS hoặc API để bắt đầu.</p>
          </section>
        )}
      </div>
    </SidebarLayout>
  );
}
