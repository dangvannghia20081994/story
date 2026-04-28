"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import {
  AudioWeb,
  splitIntoSentences,
  type AudioWebHandle,
  type AudioWebReadingHighlight,
} from "@/components/AudioWeb";
import { apiFetch } from "@/lib/api";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { getSavedChapterId, setSavedChapterId } from "@/lib/readingProgress";
import { storyListenAudioHref } from "@/lib/storyPath";

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

type Story = {
  id: number;
  title: string;
  chapters?: Chapter[];
};

type StoryShowRead = Story & {
  read_chapter?: Chapter;
  read_navigation?: ReadNav;
};

type ChaptersPage = {
  data: Chapter[];
  current_page: number;
  last_page: number;
};

/** Cùng chiều cao vùng nội dung với Navbar cố định `h-14` (3.5rem) — tránh 100dvh + header gây scrollbar trang. */
const PAGE_FRAME = "flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden";

const shell =
  "rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75";

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

function mergeChapterList(prev: Chapter[], incoming: Chapter[]): Chapter[] {
  const map = new Map<number, Chapter>();
  for (const c of prev) {
    map.set(c.id, { ...c });
  }
  for (const c of incoming) {
    const existing = map.get(c.id);
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

function chapterAudioUrl(c: Chapter | undefined): string | null {
  if (!c) return null;
  return resolvePlayableAudioUrl(c.audio_url, c.audio_path);
}

function ListenStoryPageContent() {
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
  const [showToc, setShowToc] = useState(false);
  const [sentenceProgress, setSentenceProgress] = useState(0);
  /** Sau khi đọc xong chương, chuyển URL chương sau rồi tự phát từ câu 0. */
  const resumePlayAfterChapterLoadRef = useRef(false);

  const chaptersRef = useRef<Chapter[]>([]);
  const loadedChapterIdRef = useRef<number | null>(null);
  const audioWebRef = useRef<AudioWebHandle | null>(null);

  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  function applySliceToList(prevList: Chapter[], slice: StoryShowRead): { chapters: Chapter[]; index: number } {
    const rc = slice.read_chapter;
    const nav = slice.read_navigation;
    if (!rc) throw new Error("Thiếu read_chapter");

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
        const pid = chapterParam ? parseInt(chapterParam, 10) : Number.NaN;

        if (chaptersRef.current.length === 0) {
          const toc = await fetchTocPage(storySlug, 1);
          if (cancelled) return;
          const shellList = toc.data.map((c) => ({ ...c, content: "" }));
          setChapters(shellList);
          chaptersRef.current = shellList;
          setTocLastPage(toc.last_page ?? 1);
          setTocLoadedPage(1);

          const targetId =
            Number.isFinite(pid) ? pid : resolveInitialChapterId(storySlug, shellList) ?? shellList[0]?.id ?? Number.NaN;
          if (!Number.isFinite(targetId)) {
            setStory(null);
            setReadNav(null);
            return;
          }

          const slice = await fetchReadSlice(storySlug, targetId);
          if (cancelled) return;
          const { chapters: merged, index } = applySliceToList(shellList, slice);
          setChapters(merged);
          chaptersRef.current = merged;
          setStory(slice);
          setReadNav(slice.read_navigation ?? null);
          setCurrentChapterIndex(index);
          loadedChapterIdRef.current = targetId;

          const pathSlug = encodeURIComponent(storySlug);
          const wantQs = `?chapter=${targetId}`;
          if (typeof window !== "undefined" && window.location.search !== wantQs) {
            router.replace(`/stories/${pathSlug}/listen${wantQs}`, { scroll: false });
          }
          return;
        }

        if (!Number.isFinite(pid)) return;
        if (loadedChapterIdRef.current === pid) return;

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
        if (!cancelled) setLoading(false);
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

  useEffect(() => {
    if (!storySlug || loading) return;
    const fromQs = chapterParam ? parseInt(chapterParam, 10) : Number.NaN;
    const id = Number.isFinite(fromQs) ? fromQs : chapters[currentChapterIndex]?.id;
    if (!Number.isFinite(id)) return;
    setSavedChapterId(storySlug, id);
  }, [storySlug, chapterParam, chapters, currentChapterIndex, loading]);

  const chapterIdFromUrl = chapterParam ? parseInt(chapterParam, 10) : Number.NaN;
  const currentChapter = useMemo(() => {
    if (Number.isFinite(chapterIdFromUrl)) {
      const hit = chapters.find((c) => c.id === chapterIdFromUrl);
      if (hit) return hit;
    }
    return chapters[currentChapterIndex];
  }, [chapters, chapterIdFromUrl, currentChapterIndex]);

  const chaptersTotalDisplay = readNav?.chapters_total ?? chapters.length;
  const chapterOrdinal = readNav?.chapter_index ?? currentChapterIndex + 1;
  const pathSlugEnc = encodeURIComponent(storySlug);

  const listenChapterAudioUrl = useMemo(() => chapterAudioUrl(currentChapter), [currentChapter]);
  const storyForListenLinks = useMemo(
    () => ({ id: story?.id ?? 0, slug: storySlug }),
    [story?.id, storySlug],
  );

  const sentenceCount = useMemo(
    () => splitIntoSentences(currentChapter?.content ?? "").length,
    [currentChapter?.content, currentChapter?.id],
  );

  const totalProgress = useMemo(() => {
    if (chaptersTotalDisplay <= 0) return 0;
    const ord = Math.max(1, chapterOrdinal);
    const frac = sentenceCount > 0 ? Math.min(1, Math.max(0, sentenceProgress)) : 0;
    return Math.min(1, Math.max(0, (ord - 1 + frac) / chaptersTotalDisplay));
  }, [chapterOrdinal, chaptersTotalDisplay, sentenceProgress, sentenceCount]);

  useEffect(() => {
    setSentenceProgress(0);
  }, [currentChapter?.id]);

  useEffect(() => {
    if (!resumePlayAfterChapterLoadRef.current) return;
    if (!currentChapter?.content?.trim()) return;
    resumePlayAfterChapterLoadRef.current = false;
    const t = window.setTimeout(() => {
      audioWebRef.current?.playFromSentence(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [currentChapter?.id, currentChapter?.content]);

  const onListenHighlightChange = useCallback(
    (h: AudioWebReadingHighlight) => {
      if (sentenceCount <= 0) {
        setSentenceProgress(0);
        return;
      }
      if (h.sentenceIndex !== null) {
        setSentenceProgress(Math.min(1, (h.sentenceIndex + 1) / sentenceCount));
        return;
      }
      if (!h.isPlaying) {
        setSentenceProgress(0);
      }
    },
    [sentenceCount],
  );

  const onReadthroughEnd = useCallback(() => {
    if (!readNav?.next?.id) return;
    resumePlayAfterChapterLoadRef.current = true;
    loadedChapterIdRef.current = null;
    router.replace(`/stories/${pathSlugEnc}/listen?chapter=${readNav.next.id}`, { scroll: false });
  }, [readNav?.next?.id, router, pathSlugEnc]);

  const goToChapter = useCallback(
    (index: number) => {
      const ch = chapters[index];
      if (!ch) return;
      loadedChapterIdRef.current = null;
      router.replace(`/stories/${pathSlugEnc}/listen?chapter=${ch.id}`, { scroll: false });
      setShowToc(false);
    },
    [chapters, router, pathSlugEnc],
  );

  const hasPrev = Boolean(readNav?.prev) || currentChapterIndex > 0;
  const hasNext = Boolean(readNav?.next) || currentChapterIndex < chapters.length - 1;

  const goToPrev = useCallback(() => {
    const id = readNav?.prev?.id ?? chapters[currentChapterIndex - 1]?.id;
    if (!id) return;
    loadedChapterIdRef.current = null;
    router.replace(`/stories/${pathSlugEnc}/listen?chapter=${id}`, { scroll: false });
  }, [readNav?.prev?.id, chapters, currentChapterIndex, router, pathSlugEnc]);

  const goToNext = useCallback(() => {
    const id = readNav?.next?.id ?? chapters[currentChapterIndex + 1]?.id;
    if (!id) return;
    loadedChapterIdRef.current = null;
    router.replace(`/stories/${pathSlugEnc}/listen?chapter=${id}`, { scroll: false });
  }, [readNav?.next?.id, chapters, currentChapterIndex, router, pathSlugEnc]);

  if (loading) {
    return (
      <div className={`${PAGE_FRAME} items-center justify-center px-4`}>
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
      <div className={`${PAGE_FRAME} items-center justify-center gap-4 px-4`}>
        <div className={`${shell} max-w-md p-8 text-center`}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Thiếu slug truyện trong đường dẫn.</p>
        </div>
      </div>
    );
  }

  if (!story || chapters.length === 0 || !currentChapter) {
    return (
      <div className={`${PAGE_FRAME} items-center justify-center gap-4 px-4`}>
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
    <div className={PAGE_FRAME}>
      <header className="z-20 shrink-0 border-b border-white/60 bg-white/85 px-3 py-2.5 shadow-sm backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/80 sm:px-4 sm:py-3 md:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 w-full items-center gap-2 sm:flex-1 sm:gap-3">
            <Link
              href={`/stories/${encodeURIComponent(storySlug)}`}
              className="shrink-0 rounded-full border border-indigo-200/60 bg-gradient-to-r from-white to-indigo-50/80 px-2.5 py-1.5 text-xs font-medium text-indigo-800 shadow-sm transition hover:border-indigo-300 hover:from-indigo-50 hover:to-violet-50 dark:border-indigo-800/60 dark:from-zinc-900 dark:to-indigo-950/50 dark:text-indigo-200 dark:hover:to-violet-950/40 sm:px-3 sm:text-sm"
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
              <div className="mt-2 hidden max-w-md sm:block">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(totalProgress * 100)}
                  aria-label="Tiến độ nghe toàn truyện"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 transition-[width] duration-500 dark:from-indigo-400 dark:via-violet-500 dark:to-sky-400"
                    style={{ width: `${totalProgress * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex w-full min-w-0 shrink-0 flex-wrap items-stretch gap-2 sm:w-auto sm:items-center sm:justify-end">
            {listenChapterAudioUrl ? (
              <Link
                href={storyListenAudioHref(storyForListenLinks, currentChapter.id)}
                className="inline-flex min-h-[2.75rem] items-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-teal-500 hover:shadow-emerald-500/35 dark:from-emerald-600 dark:to-teal-600 dark:shadow-emerald-900/40"
              >
                Nghe audio
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setShowToc((v) => !v)}
              className={`min-h-[2.75rem] min-w-0 flex-1 truncate rounded-xl border px-3 py-2 text-left text-xs font-semibold shadow-sm transition sm:max-w-[min(100%,18rem)] sm:flex-none sm:text-sm ${
                showToc
                  ? "border-transparent bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-indigo-500/25 dark:from-indigo-600 dark:to-violet-600 dark:shadow-indigo-900/40 dark:text-white"
                  : "border-indigo-200/70 bg-gradient-to-r from-white to-indigo-50/70 text-zinc-800 hover:border-indigo-300 hover:from-indigo-50 hover:to-violet-50 dark:border-indigo-800/60 dark:from-zinc-900 dark:to-indigo-950/40 dark:text-zinc-100 dark:hover:to-violet-950/35"
              }`}
              aria-expanded={showToc}
            >
              <span
                className={
                  showToc ? "text-white/85" : "text-zinc-400 dark:text-zinc-500"
                }
              >
                Mục lục ·{" "}
              </span>
              {currentChapter?.title ?? "Chương"}
            </button>
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
                        ? "bg-gradient-to-r from-indigo-100 to-violet-100 font-medium text-indigo-950 shadow-sm dark:from-indigo-950/70 dark:to-violet-950/50 dark:text-indigo-50"
                        : "text-zinc-700 hover:bg-gradient-to-r hover:from-zinc-50 hover:to-indigo-50/50 dark:text-zinc-300 dark:hover:from-zinc-800/60 dark:hover:to-indigo-950/20"
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
                  className="w-full rounded-xl border border-indigo-200/80 bg-gradient-to-r from-white to-indigo-50/80 py-2.5 text-xs font-semibold text-indigo-900 shadow-sm transition hover:from-indigo-50 hover:to-violet-50 disabled:opacity-60 dark:border-indigo-800/60 dark:from-zinc-900 dark:to-indigo-950/40 dark:text-indigo-100 dark:hover:to-violet-950/30"
                >
                  {loadingTocMore ? "Đang tải…" : "Tải thêm mục lục"}
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-stretch justify-center gap-3 overflow-y-auto overscroll-contain px-4 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0.75rem))] md:px-6 md:pb-[max(1.5rem,env(safe-area-inset-bottom,0.75rem))]">
        <div className="sm:hidden">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(totalProgress * 100)}
            aria-label="Tiến độ nghe toàn truyện"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 transition-[width] duration-500 dark:from-indigo-400 dark:via-violet-500 dark:to-sky-400"
              style={{ width: `${totalProgress * 100}%` }}
            />
          </div>
        </div>
        <AudioWeb
          ref={audioWebRef}
          text={currentChapter.content ?? ""}
          onReadthroughEnd={onReadthroughEnd}
          onHighlightChange={onListenHighlightChange}
          positionStorageKey={story?.id != null ? `story-audioweb:${story.id}:${currentChapter.id}` : undefined}
          onGoToPreviousChapter={goToPrev}
          onGoToNextChapter={goToNext}
          canGoToPreviousChapter={hasPrev}
          canGoToNextChapter={hasNext}
        />
      </main>
    </div>
  );
}

function ListenStoryPageFallback() {
  return (
    <div className={`${PAGE_FRAME} items-center justify-center px-4`}>
      <div className={`${shell} w-full max-w-md space-y-4 p-8`}>
        <div className="h-2 w-3/4 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-2 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-2 w-5/6 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <p className="pt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">Đang tải…</p>
      </div>
    </div>
  );
}

export default function ListenStoryPage() {
  return (
    <Suspense fallback={<ListenStoryPageFallback />}>
      <ListenStoryPageContent />
    </Suspense>
  );
}
