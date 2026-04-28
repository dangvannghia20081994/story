"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { isSpeechSynthesisSupported } from "@/lib/browserSpeech";
import { apiFetch } from "@/lib/api";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { getSavedChapterId, setSavedChapterId } from "@/lib/readingProgress";
import { storyListenAudioHref, storyListenHref } from "@/lib/storyPath";

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
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const chaptersRef = useRef<Chapter[]>([]);
  const loadedChapterIdRef = useRef<number | null>(null);

  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  useEffect(() => {
    setTtsSupported(isSpeechSynthesisSupported());
  }, []);

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
            router.replace(`/stories/${pathSlug}/read${wantQs}`, { scroll: false });
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

  const readChapterAudioUrl = useMemo(() => chapterAudioUrl(currentChapter), [currentChapter]);
  const storyForListenLinks = useMemo(
    () => ({ id: story?.id ?? 0, slug: storySlug }),
    [story?.id, storySlug],
  );

  const hasPrev = Boolean(readNav?.prev) || currentChapterIndex > 0;
  const hasNext = Boolean(readNav?.next) || currentChapterIndex < chapters.length - 1;

  const scrollReadPaneToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    const main = mainScrollRef.current;
    if (main) {
      main.scrollTo({ top: 0, behavior });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }, []);

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
              className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-zinc-200/90 bg-white/80 px-3 text-xs font-medium text-zinc-600 transition hover:border-indigo-200 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:text-indigo-300 sm:text-sm"
            >
              ← Truyện
            </Link>
            <div className="hidden h-6 w-px shrink-0 self-center bg-zinc-200 dark:bg-zinc-700 sm:block" aria-hidden />
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
          <div className="flex w-full min-w-0 shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
            {ttsSupported !== false ? (
              <Link
                href={storyListenHref(storyForListenLinks, currentChapter.id)}
                className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 sm:text-sm dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/60"
              >
                Nghe (TTS)
              </Link>
            ) : (
              <span
                role="button"
                aria-disabled
                title="Trình duyệt không hỗ trợ đọc TTS (Web Speech API)"
                className="inline-flex h-11 shrink-0 cursor-not-allowed items-center justify-center whitespace-nowrap rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-xs font-semibold text-zinc-400 opacity-80 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-500"
              >
                Nghe (TTS)
              </span>
            )}
            {readChapterAudioUrl ? (
              <Link
                href={storyListenAudioHref(storyForListenLinks, currentChapter.id)}
                className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 sm:text-sm dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/55"
              >
                Nghe audio
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setShowToc((v) => !v)}
              className={`inline-flex h-11 min-w-0 flex-1 items-center rounded-xl border px-3 text-left text-xs font-semibold transition sm:max-w-[min(100%,18rem)] sm:flex-none sm:text-sm ${
                showToc
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-100"
                  : "border-zinc-200 bg-white/80 text-zinc-800 hover:border-indigo-200 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:border-indigo-800"
              }`}
              aria-expanded={showToc}
            >
              <span className="flex min-w-0 flex-1 items-center gap-0">
                <span className="shrink-0 text-zinc-400 dark:text-zinc-500">Mục lục · </span>
                <span className="min-w-0 truncate">{currentChapter?.title ?? "Chương"}</span>
              </span>
            </button>
            <div className="flex h-11 shrink-0 items-stretch overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-900/80">
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                className="inline-flex min-w-[2.25rem] items-center justify-center px-2 text-xs font-semibold text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Giảm cỡ chữ"
              >
                A-
              </button>
              <span className="flex min-w-[1.75rem] items-center justify-center border-x border-zinc-200/90 bg-zinc-100/80 text-[10px] font-medium tabular-nums text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                {fontSize}
              </span>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(28, s + 2))}
                className="inline-flex min-w-[2.25rem] items-center justify-center px-2 text-xs font-semibold text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-800"
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
      >
        <article className={`relative z-0 ${shell} mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-10`}>
          <h2
            className="mb-8 text-center text-base font-semibold text-zinc-600 dark:text-zinc-400 md:text-lg"
            style={{ fontSize: `${Math.min(fontSize + 2, 22)}px` }}
          >
            {currentChapter.title}
          </h2>
          <div
            className="whitespace-pre-wrap text-pretty leading-[1.85] text-zinc-800 selection:bg-indigo-200/60 selection:text-zinc-900 dark:text-zinc-200 dark:selection:bg-indigo-900/50 dark:selection:text-zinc-100"
            style={{ fontSize: `${fontSize}px` }}
          >
            {currentChapter.content}
          </div>
        </article>
      </main>

      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 pb-4 pt-2 md:px-8">
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
