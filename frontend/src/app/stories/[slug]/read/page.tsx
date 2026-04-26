"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { AudioPlayer } from "@/components/AudioPlayer";
import {
  AudioWeb,
  splitIntoSentences,
  type AudioWebHandle,
  type AudioWebReadingHighlight,
} from "@/components/AudioWeb";

function readProgressStorageKey(storyId: string): string {
  return `story-read:${storyId}`;
}

type Chapter = {
  id: number;
  title: string;
  content: string;
  audio_path: string | null;
  audio_url?: string | null;
  duration: number;
};

function resolveInitialChapterIndex(storyId: string, list: Chapter[]): number {
  if (list.length === 0) return 0;
  try {
    const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("chapter") : null;
    if (q) {
      const id = parseInt(q, 10);
      if (Number.isFinite(id)) {
        const i = list.findIndex((c) => c.id === id);
        if (i >= 0) return i;
      }
    }
    const raw = localStorage.getItem(readProgressStorageKey(storyId));
    if (raw) {
      const id = parseInt(raw, 10);
      if (Number.isFinite(id)) {
        const i = list.findIndex((c) => c.id === id);
        if (i >= 0) return i;
      }
    }
  } catch {
    /* ignore */
  }
  return 0;
}

function chapterAudioUrl(c: Chapter | undefined): string | null {
  if (!c) return null;
  return resolvePlayableAudioUrl(c.audio_url, c.audio_path);
}

type Story = {
  id: number;
  title: string;
  chapters?: Chapter[];
};

type ReadPayload = {
  story: Story;
  chapters: Chapter[];
};

/**
 * Cache promise theo slug để tránh gọi API lặp ở dev Strict Mode
 * (effect mount/unmount/mount lại). Nếu request lỗi thì xóa cache để lần sau retry.
 */
const readPayloadPromiseCache = new Map<string, Promise<ReadPayload>>();

async function loadReadPayload(storySlug: string): Promise<ReadPayload> {
  const cached = readPayloadPromiseCache.get(storySlug);
  if (cached) return cached;

  const task = (async () => {
    const key = encodeURIComponent(storySlug);
    const storyRes = await apiFetch<{ data: Story }>(
      `/api/stories/${key}?chapters_order=asc&chapters_full=1`,
    );
    const chapters = [...(storyRes.data.chapters ?? [])];

    return {
      story: storyRes.data,
      chapters,
    };
  })().catch((error) => {
    readPayloadPromiseCache.delete(storySlug);
    throw error;
  });

  readPayloadPromiseCache.set(storySlug, task);
  return task;
}

const shell =
  "rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75";

function ReadStoryPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chapterParam = searchParams.get("chapter");
  const rawSlug = params?.slug;
  const storySlug = Array.isArray(rawSlug) ? (rawSlug[0] ?? "") : (rawSlug ?? "");

  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [showToc, setShowToc] = useState(false);
  const readScrollRef = useRef<HTMLElement | null>(null);
  const lastSyncedRatioRef = useRef(-1);

  useEffect(() => {
    lastSyncedRatioRef.current = -1;
  }, [currentChapterIndex]);

  useEffect(() => {
    if (!storySlug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const payload = await loadReadPayload(storySlug);
        if (cancelled) return;

        setStory(payload.story);
        const list = payload.chapters;
        const initialIdx = resolveInitialChapterIndex(storySlug, list);
        setChapters(list);
        setCurrentChapterIndex(initialIdx);
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to load:", e);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [storySlug]);

  useEffect(() => {
    if (!showToc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowToc(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showToc]);

  /** Đồng bộ index khi đổi query (back/forward, link có ?chapter=). */
  useEffect(() => {
    if (!storySlug || chapters.length === 0 || loading) return;
    if (chapterParam == null || chapterParam === "") return;
    const id = parseInt(chapterParam, 10);
    if (!Number.isFinite(id)) return;
    const idx = chapters.findIndex((c) => c.id === id);
    if (idx < 0) return;
    setCurrentChapterIndex((prev) => (prev === idx ? prev : idx));
  }, [chapterParam, chapters, loading, storySlug]);

  /** Lưu localStorage + cập nhật URL khi đang đọc chương nào. */
  useEffect(() => {
    if (!storySlug || chapters.length === 0 || loading) return;
    const ch = chapters[currentChapterIndex];
    if (!ch) return;
    try {
      localStorage.setItem(readProgressStorageKey(storySlug), String(ch.id));
    } catch {
      /* ignore */
    }
    const qs = `?chapter=${ch.id}`;
    const pathSlug = encodeURIComponent(storySlug);
    if (typeof window !== "undefined" && window.location.search !== qs) {
      router.replace(`/stories/${pathSlug}/read${qs}`, { scroll: false });
    }
  }, [storySlug, chapters, currentChapterIndex, loading, router]);

  const currentChapter = chapters[currentChapterIndex];

  useEffect(() => {
    if (!story) return;
    if (chapters.length === 0) {
      document.title = story.title;
      return;
    }
    const n = currentChapterIndex + 1;
    document.title = `${story.title} · Chương ${n}/${chapters.length}`;
  }, [story, chapters.length, currentChapterIndex]);
  const hasPrev = currentChapterIndex > 0;
  const hasNext = currentChapterIndex < chapters.length - 1;
  const audioUrl = chapterAudioUrl(currentChapter);

  const sentenceElementsRef = useRef<(HTMLElement | null)[]>([]);
  const audioWebRef = useRef<AudioWebHandle | null>(null);
  const [readTtsHighlight, setReadTtsHighlight] = useState<{
    sentenceIndex: number | null;
    isPlaying: boolean;
    word: { start: number; end: number } | null;
  }>({ sentenceIndex: null, isPlaying: false, word: null });

  const readSentences = useMemo(
    () => splitIntoSentences(currentChapter?.content ?? ""),
    [currentChapter?.content],
  );

  useEffect(() => {
    sentenceElementsRef.current.length = readSentences.length;
  }, [readSentences.length, currentChapter?.id]);

  useEffect(() => {
    setReadTtsHighlight({ sentenceIndex: null, isPlaying: false, word: null });
  }, [currentChapter?.id]);

  const onReadHighlightChange = useCallback((h: AudioWebReadingHighlight) => {
    setReadTtsHighlight({
      sentenceIndex: h.sentenceIndex,
      isPlaying: h.isPlaying,
      word: h.wordInSentence,
    });
  }, []);

  const scrollReadToAudioRatio = useCallback((ratio: number) => {
    const el = readScrollRef.current;
    if (!el) return;
    const r = Math.min(1, Math.max(0, ratio));
    const rect = el.getBoundingClientRect();
    const anchorTop = window.scrollY + rect.top;
    const contentHeight = el.offsetHeight;
    const viewport = window.innerHeight;
    const headerReserve = 88;
    const scrollMin = Math.max(0, anchorTop - headerReserve);
    const scrollMax = Math.max(scrollMin + 1, anchorTop + contentHeight - viewport + 24);
    const target = scrollMin + r * (scrollMax - scrollMin);
    window.scrollTo({ top: target, behavior: "auto" });
  }, []);

  /** Cuộn trang theo tiến độ audio (ước lượng tuyến tính theo thời lượng file). */
  const onPlaybackProgress = useCallback(
    (current: number, dur: number, playing: boolean) => {
      if (!playing || dur <= 0) return;
      const ratio = Math.min(1, Math.max(0, current / dur));
      if (lastSyncedRatioRef.current >= 0 && Math.abs(ratio - lastSyncedRatioRef.current) < 0.018) {
        return;
      }
      lastSyncedRatioRef.current = ratio;
      scrollReadToAudioRatio(ratio);
    },
    [scrollReadToAudioRatio],
  );

  const onSeekComplete = useCallback(
    (current: number, dur: number) => {
      if (dur <= 0) return;
      lastSyncedRatioRef.current = -1;
      scrollReadToAudioRatio(current / dur);
    },
    [scrollReadToAudioRatio],
  );

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

  if (!storySlug) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4">
        <div className={`${shell} max-w-md p-8 text-center`}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Thiếu slug truyện trong đường dẫn.</p>
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
            href={`/stories/${encodeURIComponent(storySlug)}`}
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
              href={`/stories/${encodeURIComponent(storySlug)}`}
              className="shrink-0 rounded-full border border-zinc-200/90 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-indigo-200 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:text-indigo-300 sm:text-sm"
            >
              ← Truyện
            </Link>
            <div className="hidden h-4 w-px bg-zinc-200 dark:bg-zinc-700 sm:block" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{story.title}</p>
              <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Chương {currentChapterIndex + 1}/{chapters.length}
                {currentChapter ? ` · ${currentChapter.title}` : ""}
              </p>
            </div>
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

      <main className="relative z-0 flex-1 px-4 py-6 md:px-8 md:py-10">
        <article ref={readScrollRef} className={`relative z-0 ${shell} mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-10`}>
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
            {audioUrl ? (
              <div className="whitespace-pre-wrap selection:bg-indigo-200/60 selection:text-zinc-900 dark:selection:bg-indigo-900/50 dark:selection:text-zinc-100">
                {currentChapter?.content}
              </div>
            ) : readSentences.length === 0 ? (
              <div className="whitespace-pre-wrap selection:bg-indigo-200/60 selection:text-zinc-900 dark:selection:bg-indigo-900/50 dark:selection:text-zinc-100">
                {currentChapter?.content}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-left selection:bg-indigo-200/60 selection:text-zinc-900 dark:selection:bg-indigo-900/50 dark:selection:text-zinc-100">
                {readSentences.map((sentence, i) => {
                  const isPlayingHere =
                    readTtsHighlight.isPlaying && readTtsHighlight.sentenceIndex === i;
                  const idleHere =
                    !readTtsHighlight.isPlaying &&
                    readTtsHighlight.sentenceIndex === i &&
                    readTtsHighlight.sentenceIndex !== null;
                  const wr =
                    readTtsHighlight.sentenceIndex === i ? readTtsHighlight.word : null;

                  return (
                    <span
                      key={`rt-${currentChapter?.id}-${i}`}
                      ref={(el) => {
                        sentenceElementsRef.current[i] = el;
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() => audioWebRef.current?.playFromSentence(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          audioWebRef.current?.playFromSentence(i);
                        }
                      }}
                      className={`mb-1 inline cursor-pointer rounded px-0.5 transition-all duration-200 ${
                        isPlayingHere
                          ? "bg-amber-200/95 font-medium text-zinc-900 shadow-sm ring-1 ring-amber-400/60 dark:bg-amber-400/25 dark:text-amber-50 dark:ring-amber-500/40"
                          : idleHere
                            ? "bg-indigo-100/90 text-indigo-950 dark:bg-indigo-950/50 dark:text-indigo-100"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                      } ${isPlayingHere ? "motion-safe:scale-[1.02]" : ""}`}
                    >
                      {isPlayingHere && wr && wr.end > wr.start ? (
                        <>
                          {sentence.slice(0, wr.start)}
                          <mark className="rounded-sm bg-violet-300/90 px-0.5 text-zinc-900 dark:bg-violet-600/50 dark:text-zinc-50">
                            {sentence.slice(wr.start, wr.end)}
                          </mark>
                          {sentence.slice(wr.end)}
                        </>
                      ) : (
                        sentence
                      )}{" "}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </article>
      </main>

      <div className="sticky bottom-0 z-[40] mt-auto border-t border-indigo-200/35 bg-gradient-to-t from-white/97 via-indigo-50/40 to-violet-50/35 shadow-[0_-8px_32px_-10px_rgba(79,70,229,0.14)] backdrop-blur-xl dark:border-indigo-900/40 dark:from-zinc-950/97 dark:via-indigo-950/25 dark:to-violet-950/20">
        <div className="relative isolate mx-auto w-full max-w-3xl space-y-0 px-4 pb-2 pt-1.5 md:px-8 md:pb-3">
          {audioUrl ? (
            <AudioPlayer
              layout="read"
              src={audioUrl}
              speechText={currentChapter.content}
              initialChapterId={currentChapter.id}
              chapters={chapters.map((c) => ({
                id: c.id,
                title: c.title,
                audio_url: chapterAudioUrl(c),
                speech_text: c.content,
              }))}
              onChapterChange={(id) => {
                const idx = chapters.findIndex((c) => c.id === id);
                if (idx >= 0) setCurrentChapterIndex(idx);
              }}
              onPlaybackProgress={onPlaybackProgress}
              onSeekComplete={onSeekComplete}
              durationHintSec={currentChapter.duration > 0 ? currentChapter.duration : null}
            />
          ) : (
            <AudioWeb
              ref={audioWebRef}
              key={currentChapter.id}
              text={currentChapter.content ?? ""}
              sentenceElementsRef={sentenceElementsRef}
              onHighlightChange={onReadHighlightChange}
              positionStorageKey={
                story?.id != null
                  ? `story-audioweb:${story.id}:${currentChapter.id}`
                  : undefined
              }
              className="border-0 bg-transparent shadow-none dark:bg-transparent"
            />
          )}
          <div className="flex items-center justify-between gap-3 border-t border-white/60 pt-1.5 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={goToPrev}
              disabled={!hasPrev}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition md:px-4 md:py-2 md:text-sm ${
                hasPrev
                  ? "border border-zinc-200 bg-white text-zinc-800 hover:border-indigo-200 hover:bg-indigo-50/80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40"
                  : "cursor-not-allowed border border-transparent text-zinc-300 dark:text-zinc-600"
              }`}
            >
              ← Trước
            </button>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 md:px-3 md:py-1 md:text-xs">
              {currentChapterIndex + 1} / {chapters.length}
            </span>
            <button
              type="button"
              onClick={goToNext}
              disabled={!hasNext}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition md:px-4 md:py-2 md:text-sm ${
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

function ReadStoryPageFallback() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4">
      <div className={`${shell} w-full max-w-md space-y-4 p-8`}>
        <div className="h-2 w-3/4 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-2 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-2 w-5/6 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <p className="pt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">Đang tải…</p>
      </div>
    </div>
  );
}

export default function ReadStoryPage() {
  return (
    <Suspense fallback={<ReadStoryPageFallback />}>
      <ReadStoryPageContent />
    </Suspense>
  );
}
