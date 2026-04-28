"use client";

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { getSavedChapterId, setSavedChapterId } from "@/lib/readingProgress";
import { AudioPlayer } from "@/components/AudioPlayer";
import {
  AudioWeb,
  splitIntoSentences,
  type AudioWebHandle,
  type AudioWebReadingHighlight,
} from "@/components/AudioWeb";

type Chapter = {
  id: number;
  title: string;
  content: string;
  audio_path: string | null;
  audio_url?: string | null;
  duration: number;
  chapter_number?: number | null;
};

type ReadNav = {
  chapter_index: number;
  chapters_total: number;
  prev: { id: number; title: string; audio_url?: string | null; duration?: number } | null;
  next: { id: number; title: string; audio_url?: string | null; duration?: number } | null;
};

type StoryShowRead = Story & {
  read_chapter?: Chapter;
  read_navigation?: ReadNav;
};

function chapterReadOrder(a: Chapter, b: Chapter): number {
  const aN = a.chapter_number;
  const bN = b.chapter_number;
  const aMissing = aN == null || aN === undefined;
  const bMissing = bN == null || bN === undefined;
  if (aMissing && bMissing) return a.id - b.id;
  if (aMissing) return 1;
  if (bMissing) return -1;
  if (aN !== bN) return aN - bN;
  return a.id - b.id;
}

function resolveInitialChapterId(storySlug: string, list: Chapter[]): number | null {
  if (list.length === 0) return null;
  try {
    const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("chapter") : null;
    if (q) {
      const id = parseInt(q, 10);
      if (Number.isFinite(id)) return id;
    }
    const saved = getSavedChapterId(storySlug);
    if (saved != null) return saved;
  } catch {
    /* ignore */
  }
  return list[0]?.id ?? null;
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

type ChaptersPage = {
  data: Chapter[];
  current_page: number;
  last_page: number;
};

function mergeChapterList(prev: Chapter[], incoming: Chapter[]): Chapter[] {
  const map = new Map<number, Chapter>();
  for (const c of prev) {
    map.set(c.id, { ...c });
  }
  for (const c of incoming) {
    const existing = map.get(c.id);
    /** Giữ metadata TOC (vd. chapter_number) khi incoming là stub prev/next — không thì sort đẩy xuống cuối list. */
    map.set(c.id, {
      ...(existing ?? {}),
      ...c,
      chapter_number: c.chapter_number ?? existing?.chapter_number,
      content: c.content && c.content.trim() !== "" ? c.content : (existing?.content ?? ""),
    });
  }
  return Array.from(map.values()).sort(chapterReadOrder);
}

async function fetchTocPage(storySlug: string, page: number): Promise<ChaptersPage> {
  const key = encodeURIComponent(storySlug);
  return apiFetch<ChaptersPage>(`/api/stories/${key}/chapters?omit_content=1&per_page=100&page=${page}`);
}

async function fetchReadSlice(storySlug: string, chapterId: number): Promise<StoryShowRead> {
  const key = encodeURIComponent(storySlug);
  const res = await apiFetch<{ data: StoryShowRead }>(`/api/stories/${key}?read_chapter=${chapterId}`);
  return res.data;
}

const shell =
  "rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75";

function isKeyboardChapterNavBlocked(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return false;
  return Boolean(el.closest("input, textarea, select, [contenteditable='true']"));
}

function ReadStoryPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chapterParam = searchParams.get("chapter");
  const rawSlug = params?.slug;
  const storySlug = Array.isArray(rawSlug) ? (rawSlug[0] ?? "") : (rawSlug ?? "");

  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [readNav, setReadNav] = useState<ReadNav | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tocLastPage, setTocLastPage] = useState(1);
  const [tocLoadedPage, setTocLoadedPage] = useState(0);
  const [loadingTocMore, setLoadingTocMore] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [showToc, setShowToc] = useState(false);
  const readScrollRef = useRef<HTMLElement | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const lastSyncedRatioRef = useRef(-1);
  const chaptersRef = useRef<Chapter[]>([]);
  const loadedChapterIdRef = useRef<number | null>(null);

  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  useEffect(() => {
    lastSyncedRatioRef.current = -1;
  }, [currentChapterIndex]);

  function applySliceToList(prevList: Chapter[], slice: StoryShowRead): { chapters: Chapter[]; index: number } {
    const rc = slice.read_chapter;
    const nav = slice.read_navigation;
    if (!rc) {
      throw new Error("Thiếu read_chapter");
    }
    const stubs: Chapter[] = [];
    if (nav?.prev) {
      stubs.push({
        id: nav.prev.id,
        title: nav.prev.title,
        content: "",
        audio_path: null,
        duration: nav.prev.duration ?? 0,
        audio_url: nav.prev.audio_url ?? null,
      });
    }
    if (nav?.next) {
      stubs.push({
        id: nav.next.id,
        title: nav.next.title,
        content: "",
        audio_path: null,
        duration: nav.next.duration ?? 0,
        audio_url: nav.next.audio_url ?? null,
      });
    }
    const merged = mergeChapterList(prevList, [...stubs, { ...rc, content: rc.content ?? "" }]);
    const idx = merged.findIndex((c) => c.id === rc.id);
    return { chapters: merged, index: idx >= 0 ? idx : 0 };
  }

  useEffect(() => {
    setChapters([]);
    chaptersRef.current = [];
    loadedChapterIdRef.current = null;
  }, [storySlug]);

  useEffect(() => {
    if (!storySlug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const pid = chapterParam ? parseInt(chapterParam, 10) : NaN;

        if (chaptersRef.current.length === 0) {
          const toc = await fetchTocPage(storySlug, 1);
          if (cancelled) return;
          const shell = toc.data.map((c) => ({ ...c, content: "" }));
          setChapters(shell);
          chaptersRef.current = shell;
          setTocLastPage(toc.last_page ?? 1);
          setTocLoadedPage(1);

          const targetId =
            Number.isFinite(pid) ? pid : resolveInitialChapterId(storySlug, shell) ?? shell[0]?.id ?? NaN;
          if (!Number.isFinite(targetId)) {
            setStory(null);
            setReadNav(null);
            return;
          }

          const slice = await fetchReadSlice(storySlug, targetId);
          if (cancelled) return;
          const { chapters: merged, index } = applySliceToList(shell, slice);
          setChapters(merged);
          chaptersRef.current = merged;
          setStory(slice);
          setReadNav(slice.read_navigation ?? null);
          setCurrentChapterIndex(index);
          loadedChapterIdRef.current = targetId;

          const pathSlug = encodeURIComponent(storySlug);
          const wantQs = `?chapter=${targetId}`;
          if (typeof window !== "undefined" && window.location.search !== wantQs) {
            router.replace(`/stories/${pathSlug}/read${wantQs}`, { scroll: false });
          }
          return;
        }

        if (!Number.isFinite(pid)) {
          return;
        }

        if (loadedChapterIdRef.current === pid) {
          return;
        }

        const slice = await fetchReadSlice(storySlug, pid);
        if (cancelled) return;
        const { chapters: merged, index } = applySliceToList(chaptersRef.current, slice);
        setChapters(merged);
        chaptersRef.current = merged;
        setCurrentChapterIndex(index);
        setStory(slice);
        setReadNav(slice.read_navigation ?? null);
        loadedChapterIdRef.current = pid;
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load:", e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [storySlug, chapterParam, router]);

  const loadMoreToc = useCallback(async () => {
    if (!storySlug || loadingTocMore || tocLoadedPage >= tocLastPage) return;
    setLoadingTocMore(true);
    try {
      const nextPage = tocLoadedPage + 1;
      const toc = await fetchTocPage(storySlug, nextPage);
      const batch = toc.data.map((c) => ({ ...c, content: "" }));
      setChapters((prev: Chapter[]) => mergeChapterList(prev, batch));
      setTocLoadedPage(nextPage);
      setTocLastPage(toc.last_page ?? tocLastPage);
    } finally {
      setLoadingTocMore(false);
    }
  }, [storySlug, loadingTocMore, tocLoadedPage, tocLastPage]);

  useEffect(() => {
    if (!showToc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowToc(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showToc]);

  /** Đồng bộ index khi danh sách chương bổ sung (mục lục tải thêm). */
  useEffect(() => {
    if (!storySlug || chapters.length === 0 || loading) return;
    if (chapterParam == null || chapterParam === "") return;
    const id = parseInt(chapterParam, 10);
    if (!Number.isFinite(id)) return;
    const idx = chapters.findIndex((c) => c.id === id);
    if (idx < 0) return;
    setCurrentChapterIndex((prev) => (prev === idx ? prev : idx));
  }, [chapterParam, chapters, loading, storySlug]);

  /** Lưu tiến độ đọc (slug làm khóa — cùng hành vi trước đây). */
  useEffect(() => {
    if (!storySlug || loading) return;
    const fromQs = chapterParam ? parseInt(chapterParam, 10) : NaN;
    const id = Number.isFinite(fromQs) ? fromQs : chapters[currentChapterIndex]?.id;
    if (!Number.isFinite(id)) return;
    setSavedChapterId(storySlug, id);
  }, [storySlug, chapterParam, chapters, currentChapterIndex, loading]);

  const chapterIdFromUrl = chapterParam ? parseInt(chapterParam, 10) : NaN;
  const currentChapter = useMemo(() => {
    if (Number.isFinite(chapterIdFromUrl)) {
      const hit = chapters.find((c) => c.id === chapterIdFromUrl);
      if (hit) {
        return hit;
      }
    }
    return chapters[currentChapterIndex];
  }, [chapters, chapterIdFromUrl, currentChapterIndex]);

  const chaptersTotalDisplay = readNav?.chapters_total ?? chapters.length;
  const chapterOrdinal = readNav?.chapter_index ?? currentChapterIndex + 1;

  useEffect(() => {
    if (!story) return;
    if (chapters.length === 0) {
      document.title = story.title;
      return;
    }
    document.title = `${story.title} · Chương ${chapterOrdinal}/${chaptersTotalDisplay}`;
  }, [story, chapters.length, chapterOrdinal, chaptersTotalDisplay]);

  const pathSlugEnc = encodeURIComponent(storySlug);

  const hasPrev = Boolean(readNav?.prev) || currentChapterIndex > 0;
  const hasNext = Boolean(readNav?.next) || currentChapterIndex < chapters.length - 1;
  const audioUrl = chapterAudioUrl(currentChapter);

  /** Chương sau để AudioPlayer gọi `onChapterChange` + thử autoplay khi hết file — ưu tiên bản đầy đủ trong `chapters` (audio_path / URL đã resolve). */
  const autoAdvanceChapter = useMemo(() => {
    const nextFromIndex = chapters[currentChapterIndex + 1];
    const navNext = readNav?.next;
    const nextId = navNext?.id ?? nextFromIndex?.id;
    if (nextId == null || !Number.isFinite(nextId)) {
      return null;
    }
    const nextMeta =
      chapters.find((c) => c.id === nextId) ??
      (navNext
        ? {
            id: navNext.id,
            title: navNext.title,
            content: "",
            audio_path: null as string | null,
            duration: navNext.duration ?? 0,
            audio_url: navNext.audio_url ?? null,
          }
        : undefined);
    if (!nextMeta) {
      return null;
    }
    const url = chapterAudioUrl(nextMeta as Chapter);
    if (!url?.trim()) {
      return null;
    }
    return {
      id: nextMeta.id,
      title: nextMeta.title,
      audio_url: url,
      speech_text: undefined as string | undefined,
    };
  }, [readNav?.next, chapters, currentChapterIndex]);

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

  const scrollReadPaneToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    const main = mainScrollRef.current;
    if (main) {
      main.scrollTo({ top: 0, behavior });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }, []);

  /** Cuộn vùng đọc (main) theo tiến độ audio — không dùng window vì dock cố định + main overflow. */
  const scrollReadToAudioRatio = useCallback((ratio: number) => {
    const main = mainScrollRef.current;
    const article = readScrollRef.current;
    if (!main || !article) return;
    const r = Math.min(1, Math.max(0, ratio));
    const articleTop =
      article.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
    const contentHeight = article.offsetHeight;
    const viewport = main.clientHeight;
    const headerReserve = 24;
    const scrollMin = Math.max(0, articleTop - headerReserve);
    const scrollMax = Math.max(scrollMin + 1, articleTop + contentHeight - viewport + 24);
    const target = scrollMin + r * (scrollMax - scrollMin);
    main.scrollTo({ top: target, behavior: "auto" });
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
    const id = readNav?.prev?.id ?? chapters[currentChapterIndex - 1]?.id;
    if (!id) return;
    loadedChapterIdRef.current = null;
    router.replace(`/stories/${pathSlugEnc}/read?chapter=${id}`, { scroll: false });
    scrollReadPaneToTop("smooth");
  }, [readNav?.prev?.id, chapters, currentChapterIndex, router, pathSlugEnc, scrollReadPaneToTop]);

  const goToNext = useCallback(() => {
    const id = readNav?.next?.id ?? chapters[currentChapterIndex + 1]?.id;
    if (!id) return;
    loadedChapterIdRef.current = null;
    router.replace(`/stories/${pathSlugEnc}/read?chapter=${id}`, { scroll: false });
    scrollReadPaneToTop("smooth");
  }, [readNav?.next?.id, chapters, currentChapterIndex, router, pathSlugEnc, scrollReadPaneToTop]);

  const goToChapter = useCallback(
    (index: number) => {
      const ch = chapters[index];
      if (!ch) return;
      loadedChapterIdRef.current = null;
      router.replace(`/stories/${pathSlugEnc}/read?chapter=${ch.id}`, { scroll: false });
      setShowToc(false);
      scrollReadPaneToTop("smooth");
    },
    [chapters, router, pathSlugEnc, scrollReadPaneToTop],
  );

  useEffect(() => {
    if (loading || !storySlug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (showToc) return;
      if (isKeyboardChapterNavBlocked(e.target)) return;
      if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        goToNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, storySlug, showToc, hasPrev, hasNext, goToPrev, goToNext]);

  useEffect(() => {
    if (loading || !story) return;
    const main = mainScrollRef.current;
    if (!main) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    };

    const onTouchCancel = () => {
      tracking = false;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (showToc) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const minDx = 56;
      if (Math.abs(dx) < minDx) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.25) return;
      if (dx < 0 && hasPrev) {
        e.preventDefault();
        goToPrev();
      } else if (dx > 0 && hasNext) {
        e.preventDefault();
        goToNext();
      }
    };

    main.addEventListener("touchstart", onTouchStart, { passive: true });
    main.addEventListener("touchcancel", onTouchCancel);
    main.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      main.removeEventListener("touchstart", onTouchStart);
      main.removeEventListener("touchcancel", onTouchCancel);
      main.removeEventListener("touchend", onTouchEnd);
    };
  }, [loading, story, showToc, hasPrev, hasNext, goToPrev, goToNext]);

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

  if (!story || chapters.length === 0 || !currentChapter) {
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
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden">
      <header className="z-20 shrink-0 border-b border-white/60 bg-white/85 px-3 py-2.5 shadow-sm backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/80 sm:px-4 sm:py-3 md:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 w-full items-center gap-2 sm:flex-1 sm:gap-3">
            <Link
              href={`/stories/${encodeURIComponent(storySlug)}`}
              className="shrink-0 rounded-full border border-zinc-200/90 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-indigo-200 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:text-indigo-300 sm:px-3 sm:text-sm"
            >
              ← Truyện
            </Link>
            <div className="hidden h-4 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700 sm:block" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50 sm:truncate sm:leading-normal">
                {story.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-zinc-500 dark:text-zinc-400 sm:truncate sm:leading-normal">
                Chương {chapterOrdinal}/{chaptersTotalDisplay}
                {currentChapter ? ` · ${currentChapter.title}` : ""}
              </p>
            </div>
          </div>
          <div className="flex w-full min-w-0 shrink-0 items-stretch gap-2 sm:w-auto sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setShowToc((v) => !v)}
              className={`min-h-[2.75rem] min-w-0 flex-1 truncate rounded-xl border px-3 py-2 text-left text-xs font-semibold transition sm:max-w-[min(100%,18rem)] sm:flex-none sm:text-sm ${
                showToc
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-100"
                  : "border-zinc-200 bg-white/80 text-zinc-800 hover:border-indigo-200 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:border-indigo-800"
              }`}
              aria-expanded={showToc}
            >
              <span className="text-zinc-400 dark:text-zinc-500">Mục lục · </span>
              {currentChapter?.title ?? "Chương"}
            </button>
            <div className="flex shrink-0 items-center self-center rounded-xl border border-zinc-200 bg-zinc-50/90 p-0.5 dark:border-zinc-700 dark:bg-zinc-900/80">
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
          <div className="fixed left-4 right-4 top-28 z-50 mx-auto flex max-h-[min(70vh,28rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl dark:border-zinc-700 dark:bg-zinc-900/95 md:left-auto md:right-8 md:mx-0">
            <div className="shrink-0 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Mục lục · {chapters.length}/{chaptersTotalDisplay} chương
              </h3>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {chapters.map((chapter, index) => (
                <li key={chapter.id}>
                  <button
                    type="button"
                    onClick={() => goToChapter(index)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      chapter.id === currentChapter?.id
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
            {tocLoadedPage < tocLastPage ? (
              <div className="shrink-0 border-t border-zinc-100 p-2 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => void loadMoreToc()}
                  disabled={loadingTocMore}
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  {loadingTocMore ? "Đang tải…" : "Tải thêm mục lục"}
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <main
        ref={mainScrollRef}
        className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-10 pt-6 md:px-8 md:pb-12 md:pt-10"
        aria-label="Nội dung chương. Vuốt sang trái hoặc phím mũi tên trái: chương trước. Vuốt sang phải hoặc mũi tên phải: chương sau."
      >
        <article ref={readScrollRef} className={`relative z-0 ${shell} mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-10`}>
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

      <div className="relative z-10 shrink-0 border-t border-indigo-200/35 bg-gradient-to-t from-white/97 via-indigo-50/40 to-violet-50/35 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-8px_32px_-10px_rgba(79,70,229,0.14)] backdrop-blur-xl dark:border-indigo-900/40 dark:from-zinc-950/97 dark:via-indigo-950/25 dark:to-violet-950/20">
        <div className="relative isolate mx-auto w-full max-w-3xl space-y-0 px-4 pb-1 pt-1.5 md:px-8 md:pb-2 md:pt-2">
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
                speech_text: c.content?.trim() ? c.content : undefined,
              }))}
              onChapterChange={(id) => {
                loadedChapterIdRef.current = null;
                router.replace(`/stories/${pathSlugEnc}/read?chapter=${id}`, { scroll: false });
                scrollReadPaneToTop("smooth");
              }}
              onPlaybackProgress={onPlaybackProgress}
              onSeekComplete={onSeekComplete}
              durationHintSec={currentChapter.duration > 0 ? currentChapter.duration : null}
              autoAdvanceChapter={autoAdvanceChapter}
            />
          ) : (
            <AudioWeb
              ref={audioWebRef}
              text={currentChapter.content ?? ""}
              onReadthroughEnd={() => {
                if (readNav?.next?.id) {
                  loadedChapterIdRef.current = null;
                  router.replace(`/stories/${pathSlugEnc}/read?chapter=${readNav.next.id}`, {
                    scroll: false,
                  });
                  scrollReadPaneToTop("smooth");
                }
              }}
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
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/60 bg-gradient-to-t from-white/95 to-transparent px-0 pb-0.5 pt-2 dark:border-zinc-800/80 dark:from-zinc-950/95 dark:to-transparent sm:gap-3 sm:pt-2.5">
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
              {chapterOrdinal} / {chaptersTotalDisplay}
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
