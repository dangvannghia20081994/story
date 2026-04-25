"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AudioPlayer } from "@/components/AudioPlayer";

type Chapter = {
  id: number;
  title: string;
  content: string;
  audio_path: string | null;
  audio_url?: string | null;
  status: string;
  duration: number;
};

function chapterAudioUrl(c: Chapter | undefined): string | null {
  if (!c) return null;
  if (c.audio_url) return c.audio_url;
  if (c.audio_path?.startsWith("http")) return c.audio_path;
  return null;
}

type Story = {
  id: number;
  title: string;
};

const shell =
  "rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75";

export default function ReadStoryPage() {
  const params = useParams();
  const rawId = params?.id;
  const storyId = Array.isArray(rawId) ? (rawId[0] ?? "") : (rawId ?? "");

  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    if (!storyId) {
      setLoading(false);
      return;
    }
    async function loadData() {
      try {
        const [storyRes, chaptersRes] = await Promise.all([
          apiFetch<{ data: Story }>(`/api/stories/${storyId}`),
          apiFetch<{ data: Chapter[] }>(`/api/stories/${storyId}/chapters`),
        ]);
        setStory(storyRes.data);
        const list = chaptersRes.data ?? [];
        setChapters(list);
        setCurrentChapterIndex(0);
      } catch (e) {
        console.error("Failed to load:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [storyId]);

  useEffect(() => {
    if (!showToc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowToc(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showToc]);

  const currentChapter = chapters[currentChapterIndex];

  useEffect(() => {
    if (!story) return;
    document.title = story.title;
  }, [story]);
  const hasPrev = currentChapterIndex > 0;
  const hasNext = currentChapterIndex < chapters.length - 1;
  const audioUrl = chapterAudioUrl(currentChapter);

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      setCurrentChapterIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [hasPrev]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      setCurrentChapterIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [hasNext]);

  const goToChapter = useCallback((index: number) => {
    setCurrentChapterIndex(index);
    setShowToc(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4">
        <div className={`${shell} w-full max-w-md space-y-4 p-8`}>
          <div className="h-2 w-3/4 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-2 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-2 w-5/6 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <p className="pt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">Đang tải truyện…</p>
        </div>
      </div>
    );
  }

  if (!storyId) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4">
        <div className={`${shell} max-w-md p-8 text-center`}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Thiếu mã truyện trong đường dẫn.</p>
          <Link
            href="/stories"
            className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Danh sách truyện
          </Link>
        </div>
      </div>
    );
  }

  if (!story || chapters.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4">
        <div className={`${shell} max-w-md p-8 text-center`}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Không tìm thấy truyện hoặc chưa có chương.</p>
          <Link
            href={`/stories/${storyId}`}
            className="mt-4 inline-flex rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            ← Về trang truyện
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-14 z-30 border-b border-white/60 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/80 md:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Link
              href={`/stories/${storyId}`}
              className="shrink-0 rounded-full border border-zinc-200/90 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-indigo-200 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:text-indigo-300 sm:text-sm"
            >
              ← Truyện
            </Link>
            <div className="hidden h-4 w-px bg-zinc-200 dark:bg-zinc-700 sm:block" aria-hidden />
            <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-500 sm:text-sm">{story.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowToc((v) => !v)}
              className={`max-w-[10rem] truncate rounded-xl border px-3 py-2 text-left text-xs font-semibold transition sm:max-w-[14rem] sm:text-sm ${
                showToc
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-100"
                  : "border-zinc-200 bg-white/80 text-zinc-800 hover:border-indigo-200 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:border-indigo-800"
              }`}
              aria-expanded={showToc}
            >
              <span className="text-zinc-400 dark:text-zinc-500">Mục lục · </span>
              {currentChapter?.title ?? "Chương"}
            </button>
            <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-50/90 p-0.5 dark:border-zinc-700 dark:bg-zinc-900/80">
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Giảm cỡ chữ"
              >
                A−
              </button>
              <span className="px-1 text-[10px] font-medium tabular-nums text-zinc-400">{fontSize}</span>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(28, s + 2))}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Tăng cỡ chữ"
              >
                A+
              </button>
            </div>
          </div>
        </div>
      </header>

      {showToc ? (
        <>
          <button
            type="button"
            className="fixed inset-x-0 bottom-0 top-14 z-40 bg-zinc-900/45 backdrop-blur-[2px]"
            aria-label="Đóng mục lục"
            onClick={() => setShowToc(false)}
          />
          <div className="fixed left-4 right-4 top-28 z-50 mx-auto max-h-[min(70vh,28rem)] max-w-md overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl dark:border-zinc-700 dark:bg-zinc-900/95 md:left-auto md:right-8 md:mx-0">
            <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Mục lục · {chapters.length} chương
              </h3>
            </div>
            <ul className="max-h-[min(calc(70vh-4rem),24rem)] overflow-y-auto p-2">
              {chapters.map((chapter, index) => (
                <li key={chapter.id}>
                  <button
                    type="button"
                    onClick={() => goToChapter(index)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      index === currentChapterIndex
                        ? "bg-indigo-100 font-medium text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200/80 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">{chapter.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <main className="flex-1 px-4 py-6 md:px-8 md:py-10">
        <article className={`${shell} mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-10`}>
          <div className="mb-2 text-center">
            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:border-indigo-800/80 dark:bg-indigo-950/50 dark:text-indigo-200">
              Chương {currentChapterIndex + 1} / {chapters.length}
            </span>
          </div>
          <h1
            className="mb-3 text-balance text-center text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-2xl"
            style={{ fontSize: `${Math.min(fontSize + 4, 28)}px` }}
          >
            {story.title}
          </h1>
          {currentChapter ? (
            <h2
              className="mb-8 text-balance text-center text-base font-semibold text-zinc-600 dark:text-zinc-400 md:text-lg"
              style={{ fontSize: `${Math.min(fontSize + 2, 22)}px` }}
            >
              {currentChapter.title}
            </h2>
          ) : null}
          <div
            className="text-pretty leading-[1.85] text-zinc-800 dark:text-zinc-200"
            style={{ fontSize: `${fontSize}px` }}
          >
            <div className="whitespace-pre-wrap selection:bg-indigo-200/60 selection:text-zinc-900 dark:selection:bg-indigo-900/50 dark:selection:text-zinc-100">
              {currentChapter?.content}
            </div>
          </div>
        </article>
      </main>

      <div className="sticky bottom-0 z-20 mt-auto border-t border-white/70 bg-white/90 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.12)] backdrop-blur-lg dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <div className="mx-auto max-w-3xl space-y-0 px-4 py-3 md:px-6">
          {audioUrl ? (
            <div className="border-b border-zinc-200/80 pb-3 dark:border-zinc-800/80">
              <AudioPlayer
                unstyled
                src={audioUrl}
                title={`${story.title} — ${currentChapter.title}`}
                initialChapterId={currentChapter.id}
                chapters={chapters.map((c) => ({
                  id: c.id,
                  title: c.title,
                  audio_url: chapterAudioUrl(c),
                }))}
                onChapterChange={(id) => {
                  const idx = chapters.findIndex((c) => c.id === id);
                  if (idx >= 0) setCurrentChapterIndex(idx);
                }}
              />
            </div>
          ) : (
            <p className="border-b border-dashed border-zinc-200/90 pb-3 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
              Chương này chưa có audio — render TTS từ trang truyện.
            </p>
          )}
          <div className="flex items-center justify-between gap-3 pt-3">
            <button
              type="button"
              onClick={goToPrev}
              disabled={!hasPrev}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                hasPrev
                  ? "border border-zinc-200 bg-white text-zinc-800 hover:border-indigo-200 hover:bg-indigo-50/80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40"
                  : "cursor-not-allowed border border-transparent text-zinc-300 dark:text-zinc-600"
              }`}
            >
              ← Trước
            </button>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {currentChapterIndex + 1} / {chapters.length}
            </span>
            <button
              type="button"
              onClick={goToNext}
              disabled={!hasNext}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                hasNext
                  ? "border border-zinc-200 bg-white text-zinc-800 hover:border-indigo-200 hover:bg-indigo-50/80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40"
                  : "cursor-not-allowed border border-transparent text-zinc-300 dark:text-zinc-600"
              }`}
            >
              Sau →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
