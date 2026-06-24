"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import {
  AudioWeb,
  splitIntoSentences,
  type AudioWebHandle,
  type AudioWebReadingHighlight,
} from "@/components/AudioWeb";
import { apiFetch } from "@/lib/api";
import {
  applyListenReadSliceToRows,
  fetchListenReadSlice,
  mergeListenChapterRows,
  readListenSessionCache,
  touchListenSessionRoute,
  writeListenSessionCache,
  type ListenChapterRow,
  type ListenReadNav,
  type ListenStoryShowRead,
} from "@/lib/listenReadSlice";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { inFlightDedupe } from "@/lib/inFlightDedupe";
import { getSavedChapterId, setSavedChapterRef } from "@/lib/readingProgress";
import {
  chapterKey,
  resolveChapterForHref,
  storyDetailHref,
  storyKey,
  storyListenAudioHref,
} from "@/lib/storyPath";
import { useChapterPlainWithLexicons } from "@/contexts/LexiconContext";

type Chapter = ListenChapterRow;

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

/** Cố định dưới navbar (`top-14`), không nằm trong luồng cùng sticky nav — tránh tổng cao > viewport và scrollbar trang. */
const PAGE_FRAME =
  "fixed inset-x-0 bottom-0 top-14 z-0 flex min-h-0 flex-col overflow-hidden overscroll-none";

const shell =
  "rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75";

let listenTtsLastSlugForChapterReset: string | null = null;

function resolveChapterIdFromPathSegment(chapterSeg: string, list: Chapter[]): number | null {
  const t = chapterSeg.trim();
  if (t === "") return null;
  const asId = parseInt(t, 10);
  if (Number.isFinite(asId)) {
    const byId = list.find((c) => c.id === asId);
    if (byId) return byId.id;
  }
  const byKey = list.find((c) => chapterKey(c) === t);
  return byKey?.id ?? null;
}

function listenPath(storySlug: string, ch: { id: number; slug?: string | null }): string {
  return `/${encodeURIComponent(storySlug)}/${encodeURIComponent(chapterKey(ch))}/listen`;
}

function resolveListenTargetId(
  chapterSlugParam: string,
  chapterQuery: string | null,
  storySlug: string,
  list: Chapter[],
): number | null {
  const fromPath = resolveChapterIdFromPathSegment(chapterSlugParam, list);
  if (fromPath != null) return fromPath;
  if (chapterQuery) {
    const qid = parseInt(chapterQuery, 10);
    if (Number.isFinite(qid)) {
      const hit = list.find((c) => c.id === qid);
      if (hit) return hit.id;
    }
  }
  const saved = getSavedChapterId(storySlug);
  if (saved != null) {
    const hit = list.find((c) => c.id === saved);
    if (hit) return hit.id;
  }
  return list[0]?.id ?? null;
}

async function fetchTocPage(storySlug: string, page: number): Promise<ChaptersPage> {
  const key = encodeURIComponent(storySlug);
  return apiFetch<ChaptersPage>(`/api/stories/${key}/chapters?omit_content=1&per_page=100&page=${page}`);
}

function chapterAudioUrl(c: Chapter | undefined): string | null {
  if (!c) return null;
  return resolvePlayableAudioUrl(c.audio_single_url, c.audio_multiple_path);
}

function ListenStoryPageContent() {
  const params = useParams();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const searchParams = useSearchParams();
  const chapterQuery = searchParams.get("chapter");
  const rawSlug = params?.slug;
  const rawChapterSlug = params?.chapterSlug;
  const storySlug = Array.isArray(rawSlug) ? (rawSlug[0] ?? "") : (rawSlug ?? "");
  const chapterSlugParam = Array.isArray(rawChapterSlug) ? (rawChapterSlug[0] ?? "") : (rawChapterSlug ?? "");

  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [readNav, setReadNav] = useState<ListenReadNav | null>(null);
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

  useLayoutEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  useLayoutEffect(() => {
    if (!storySlug) return;
    touchListenSessionRoute("tts", storySlug);
    const hit = readListenSessionCache("tts", storySlug);
    if (!hit?.chapters?.length) return;
    setChapters(hit.chapters);
    chaptersRef.current = hit.chapters;
    if (hit.story) setStory(hit.story as Story);
    setReadNav(hit.readNav);
    setTocLastPage(hit.tocLastPage);
    setTocLoadedPage(hit.tocLoadedPage);
    const fromPath = resolveChapterIdFromPathSegment(chapterSlugParam, hit.chapters);
    const fromQs = chapterQuery ? parseInt(chapterQuery, 10) : Number.NaN;
    const pid = fromPath ?? (Number.isFinite(fromQs) ? fromQs : Number.NaN);
    if (Number.isFinite(pid)) {
      const idx = hit.chapters.findIndex((c) => c.id === pid);
      setCurrentChapterIndex(idx >= 0 ? idx : 0);
    }
    setLoading(false);
  }, [storySlug, chapterSlugParam, chapterQuery]);

  useEffect(() => {
    if (!storySlug) return;
    if (listenTtsLastSlugForChapterReset === storySlug) {
      return;
    }
    listenTtsLastSlugForChapterReset = storySlug;
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
      touchListenSessionRoute("tts", storySlug);
      const isInitialShell = chaptersRef.current.length === 0;
      if (isInitialShell) {
        setLoading(true);
      }
      try {
        if (isInitialShell) {
          const toc = await inFlightDedupe(`story-toc:${storySlug}:p1`, () => fetchTocPage(storySlug, 1));
          if (cancelled) return;
          const shellList = toc.data.map((c) => ({ ...c, content: "" }));
          setChapters(shellList);
          chaptersRef.current = shellList;
          setTocLastPage(toc.last_page ?? 1);
          setTocLoadedPage(1);

          const targetId = resolveListenTargetId(chapterSlugParam, chapterQuery, storySlug, shellList);
          if (targetId == null || !Number.isFinite(targetId)) {
            setStory(null);
            setReadNav(null);
            return;
          }

          const slice = await inFlightDedupe(`story-read:${storySlug}:ch${targetId}`, () =>
            fetchListenReadSlice(storySlug, targetId),
          );
          if (cancelled) return;
          const { chapters: merged, index } = applyListenReadSliceToRows(shellList, slice);
          setChapters(merged);
          chaptersRef.current = merged;
          setStory(slice as Story);
          setReadNav(slice.read_navigation ?? null);
          setCurrentChapterIndex(index);
          loadedChapterIdRef.current = targetId;

          writeListenSessionCache("tts", storySlug, {
            chapters: merged,
            story: slice as ListenStoryShowRead,
            readNav: slice.read_navigation ?? null,
            tocLastPage: toc.last_page ?? 1,
            tocLoadedPage: 1,
          });

          const rc = slice.read_chapter;
          if (rc && typeof window !== "undefined") {
            const wantPath = listenPath(storySlug, rc);
            if (window.location.pathname !== wantPath || window.location.search !== "") {
              routerRef.current.replace(wantPath, { scroll: false });
            }
          }
          return;
        }

        const fromPath = resolveChapterIdFromPathSegment(chapterSlugParam, chaptersRef.current);
        const fromQs = chapterQuery ? parseInt(chapterQuery, 10) : Number.NaN;
        const pid = fromPath ?? (Number.isFinite(fromQs) ? fromQs : Number.NaN);
        if (!Number.isFinite(pid)) return;
        if (loadedChapterIdRef.current === pid) return;

        const slice = await inFlightDedupe(`story-read:${storySlug}:ch${pid}`, () =>
          fetchListenReadSlice(storySlug, pid),
        );
        if (cancelled) return;
        const { chapters: merged, index } = applyListenReadSliceToRows(chaptersRef.current, slice);
        setChapters(merged);
        chaptersRef.current = merged;
        setCurrentChapterIndex(index);
        setStory(slice as Story);
        setReadNav(slice.read_navigation ?? null);
        loadedChapterIdRef.current = pid;

        const prevEntry = readListenSessionCache("tts", storySlug);
        writeListenSessionCache("tts", storySlug, {
          chapters: merged,
          story: slice as ListenStoryShowRead,
          readNav: slice.read_navigation ?? null,
          tocLastPage: prevEntry?.tocLastPage ?? 1,
          tocLoadedPage: prevEntry?.tocLoadedPage ?? 1,
        });
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load:", e);
        }
      } finally {
        if (isInitialShell && !cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [storySlug, chapterSlugParam, chapterQuery]);

  const loadMoreToc = useCallback(async () => {
    if (!storySlug || loadingTocMore || tocLoadedPage >= tocLastPage) return;
    setLoadingTocMore(true);
    try {
      const nextPage = tocLoadedPage + 1;
      const toc = await inFlightDedupe(`story-toc:${storySlug}:p${nextPage}`, () => fetchTocPage(storySlug, nextPage));
      const batch = toc.data.map((c) => ({ ...c, content: "" }));
      setChapters((prev: Chapter[]) => {
        const next = mergeListenChapterRows(prev, batch);
        const cur = readListenSessionCache("tts", storySlug);
        if (cur) {
          writeListenSessionCache("tts", storySlug, {
            ...cur,
            chapters: next,
            tocLastPage: toc.last_page ?? tocLastPage,
            tocLoadedPage: nextPage,
          });
        }
        return next;
      });
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

  const chapterIdFromUrl = useMemo(() => {
    if (chapters.length === 0) return Number.NaN;
    const fromPath = resolveChapterIdFromPathSegment(chapterSlugParam, chapters);
    if (fromPath != null) return fromPath;
    const fromQs = chapterQuery ? parseInt(chapterQuery, 10) : Number.NaN;
    return Number.isFinite(fromQs) ? fromQs : Number.NaN;
  }, [chapters, chapterSlugParam, chapterQuery]);
  const currentChapter = useMemo(() => {
    if (Number.isFinite(chapterIdFromUrl)) {
      const hit = chapters.find((c) => c.id === chapterIdFromUrl);
      if (hit) return hit;
    }
    return chapters[currentChapterIndex];
  }, [chapters, chapterIdFromUrl, currentChapterIndex]);

  useEffect(() => {
    if (!storySlug || loading) return;
    const ch = currentChapter;
    if (!ch?.id || !Number.isFinite(ch.id)) return;
    setSavedChapterRef(storySlug, { id: ch.id, slug: ch.slug });
  }, [storySlug, loading, currentChapter]);

  const chapterTtsPlain = useChapterPlainWithLexicons(currentChapter?.content ?? "");

  const chaptersTotalDisplay = readNav?.chapters_total ?? chapters.length;
  const chapterOrdinal = readNav?.chapter_index ?? currentChapterIndex + 1;

  const listenChapterAudioUrl = useMemo(() => chapterAudioUrl(currentChapter), [currentChapter]);
  const storyForListenLinks = useMemo(
    () => ({ id: story?.id ?? 0, slug: storySlug }),
    [story?.id, storySlug],
  );

  const audioWebPositionStorageKey = useMemo(() => {
    if (!currentChapter || !storySlug.trim()) return undefined;
    const sk = story ? storyKey(story) : storySlug;
    return `story-audioweb:${sk}:${chapterKey(currentChapter)}`;
  }, [story, storySlug, currentChapter]);

  const audioWebPositionLegacyKey = useMemo(() => {
    if (!story?.id || !currentChapter?.id || !audioWebPositionStorageKey) return undefined;
    return `story-audioweb:${story.id}:${currentChapter.id}`;
  }, [story?.id, currentChapter?.id, audioWebPositionStorageKey]);

  const sentenceCount = useMemo(() => splitIntoSentences(chapterTtsPlain).length, [chapterTtsPlain, currentChapter?.id]);

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
    if (!chapterTtsPlain.trim()) return;
    resumePlayAfterChapterLoadRef.current = false;
    const t = window.setTimeout(() => {
      audioWebRef.current?.playFromSentence(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [currentChapter?.id, chapterTtsPlain]);

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
    const stub = readNav?.next;
    if (!stub?.id) return;
    const next = resolveChapterForHref(stub, chapters);
    if (!next?.id) return;
    resumePlayAfterChapterLoadRef.current = true;
    loadedChapterIdRef.current = null;
    routerRef.current.replace(listenPath(storySlug, next), { scroll: false });
  }, [readNav?.next, chapters, storySlug]);

  const goToChapter = useCallback(
    (index: number) => {
      const ch = chapters[index];
      if (!ch) return;
      loadedChapterIdRef.current = null;
      routerRef.current.replace(listenPath(storySlug, ch), { scroll: false });
      setShowToc(false);
    },
    [chapters, storySlug],
  );

  const hasPrev = Boolean(readNav?.prev) || currentChapterIndex > 0;
  const hasNext = Boolean(readNav?.next) || currentChapterIndex < chapters.length - 1;

  const goToPrev = useCallback(() => {
    const stub = readNav?.prev ?? chapters[currentChapterIndex - 1];
    const prev = resolveChapterForHref(stub, chapters);
    if (!prev?.id) return;
    loadedChapterIdRef.current = null;
    routerRef.current.replace(listenPath(storySlug, prev), { scroll: false });
  }, [readNav?.prev, chapters, currentChapterIndex, storySlug]);

  const goToNext = useCallback(() => {
    const stub = readNav?.next ?? chapters[currentChapterIndex + 1];
    const next = resolveChapterForHref(stub, chapters);
    if (!next?.id) return;
    loadedChapterIdRef.current = null;
    routerRef.current.replace(listenPath(storySlug, next), { scroll: false });
  }, [readNav?.next, chapters, currentChapterIndex, storySlug]);

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
            href={storyDetailHref({ id: story?.id ?? 0, slug: storySlug })}
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
              href={storyDetailHref({ id: story?.id ?? 0, slug: storySlug })}
              className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-indigo-200/60 bg-gradient-to-r from-white to-indigo-50/80 px-3 text-xs font-medium text-indigo-800 shadow-sm transition hover:border-indigo-300 hover:from-indigo-50 hover:to-violet-50 dark:border-indigo-800/60 dark:from-zinc-900 dark:to-indigo-950/50 dark:text-indigo-200 dark:hover:to-violet-950/40 sm:text-sm"
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
          <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {listenChapterAudioUrl ? (
              <Link
                href={storyListenAudioHref(storyForListenLinks, currentChapter)}
                className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 text-xs font-semibold text-white shadow-md shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-teal-500 hover:shadow-emerald-500/35 dark:from-emerald-600 dark:to-teal-600 dark:shadow-emerald-900/40"
              >
                Nghe audio
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setShowToc((v) => !v)}
              className={`inline-flex h-11 min-w-0 flex-1 items-center rounded-xl border px-3 text-left text-xs font-semibold shadow-sm transition sm:max-w-[min(100%,18rem)] sm:flex-none sm:text-sm ${
                showToc
                  ? "border-transparent bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-indigo-500/25 dark:from-indigo-600 dark:to-violet-600 dark:shadow-indigo-900/40 dark:text-white"
                  : "border-indigo-200/70 bg-gradient-to-r from-white to-indigo-50/70 text-zinc-800 hover:border-indigo-300 hover:from-indigo-50 hover:to-violet-50 dark:border-indigo-800/60 dark:from-zinc-900 dark:to-indigo-950/40 dark:text-zinc-100 dark:hover:to-violet-950/35"
              }`}
              aria-expanded={showToc}
            >
              <span className="flex min-w-0 flex-1 items-center gap-0">
                <span className={showToc ? "shrink-0 text-white/85" : "shrink-0 text-zinc-400 dark:text-zinc-500"}>Mục lục · </span>
                <span className="min-w-0 truncate">{currentChapter?.title ?? "Chương"}</span>
              </span>
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
          text={chapterTtsPlain}
          onReadthroughEnd={onReadthroughEnd}
          onHighlightChange={onListenHighlightChange}
          positionStorageKey={audioWebPositionStorageKey}
          positionStorageLegacyKey={audioWebPositionLegacyKey}
          onGoToPreviousChapter={goToPrev}
          onGoToNextChapter={goToNext}
          canGoToPreviousChapter={hasPrev}
          canGoToNextChapter={hasNext}
        />
      </main>
    </div>
  );
}

export default function ListenStoryPage() {
  return (
    <Suspense fallback={null}>
      <ListenStoryPageContent />
    </Suspense>
  );
}
