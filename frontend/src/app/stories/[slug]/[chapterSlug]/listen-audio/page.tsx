"use client";

/**
 * Nghe truyện bằng file audio (AudioPlayer).
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AudioPlayer, type AudioChapterItem } from "@/components/AudioPlayer";
import { isSpeechSynthesisSupported } from "@/lib/browserSpeech";
import { apiFetch } from "@/lib/api";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { inFlightDedupe } from "@/lib/inFlightDedupe";
import { getSavedChapterId, setSavedChapterId } from "@/lib/readingProgress";
import { chapterKey, storyDetailHref, storyListenHref, storyReadHref } from "@/lib/storyPath";

type Chapter = {
  id: number;
  title: string;
  slug?: string | null;
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

/** Navbar `h-14` (3.5rem) sticky — tránh `min-h-screen` + nav làm nội dung vượt viewport. */
const PAGE_FRAME =
  "flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden overscroll-none bg-gradient-to-b from-indigo-50/55 via-white to-violet-50/30 dark:from-zinc-950 dark:via-zinc-950 dark:to-indigo-950/25";

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

function listenAudioPath(storySlug: string, ch: { id: number; slug?: string | null }): string {
  return `/${encodeURIComponent(storySlug)}/${encodeURIComponent(chapterKey(ch))}/listen-audio`;
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

function chapterAudioUrl(c: Chapter | undefined): string | null {
  if (!c) return null;
  return resolvePlayableAudioUrl(c.audio_url, c.audio_path);
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

function ListenAudioStoryPageContent() {
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
  const [readNav, setReadNav] = useState<ReadNav | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tocLastPage, setTocLastPage] = useState(1);
  const [tocLoadedPage, setTocLoadedPage] = useState(0);
  const [loadingTocMore, setLoadingTocMore] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [audioBarRatio, setAudioBarRatio] = useState(0);
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null);

  const chaptersRef = useRef<Chapter[]>([]);
  const loadedChapterIdRef = useRef<number | null>(null);

  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  useEffect(() => {
    setTtsSupported(isSpeechSynthesisSupported());
  }, []);

  useEffect(() => {
    setAudioBarRatio(0);
  }, [chapterSlugParam, chapterQuery]);

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
        if (chaptersRef.current.length === 0) {
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
            fetchReadSlice(storySlug, targetId),
          );
          if (cancelled) return;
          const { chapters: merged, index } = applySliceToList(shellList, slice);
          setChapters(merged);
          chaptersRef.current = merged;
          setStory(slice);
          setReadNav(slice.read_navigation ?? null);
          setCurrentChapterIndex(index);
          loadedChapterIdRef.current = targetId;

          const rc = slice.read_chapter;
          if (rc && typeof window !== "undefined") {
            const wantPath = listenAudioPath(storySlug, rc);
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

        const slice = await inFlightDedupe(`story-read:${storySlug}:ch${pid}`, () => fetchReadSlice(storySlug, pid));
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
  }, [storySlug, chapterSlugParam, chapterQuery]);

  const loadMoreToc = useCallback(async () => {
    if (!storySlug || loadingTocMore || tocLoadedPage >= tocLastPage) return;
    setLoadingTocMore(true);
    try {
      const nextPage = tocLoadedPage + 1;
      const toc = await inFlightDedupe(`story-toc:${storySlug}:p${nextPage}`, () => fetchTocPage(storySlug, nextPage));
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
    const fromPath = resolveChapterIdFromPathSegment(chapterSlugParam, chapters);
    const fromQs = chapterQuery ? parseInt(chapterQuery, 10) : Number.NaN;
    const id = fromPath ?? (Number.isFinite(fromQs) ? fromQs : chapters[currentChapterIndex]?.id);
    if (!Number.isFinite(id)) return;
    setSavedChapterId(storySlug, id);
  }, [storySlug, chapterSlugParam, chapterQuery, chapters, currentChapterIndex, loading]);

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

  const chaptersTotalDisplay = readNav?.chapters_total ?? chapters.length;
  const chapterOrdinal = readNav?.chapter_index ?? currentChapterIndex + 1;

  const audioUrl = useMemo(() => chapterAudioUrl(currentChapter), [currentChapter]);

  const totalProgress = useMemo(() => {
    if (chaptersTotalDisplay <= 0) return 0;
    const ord = Math.max(1, chapterOrdinal);
    const frac = Math.min(1, Math.max(0, audioBarRatio));
    return Math.min(1, Math.max(0, (ord - 1 + frac) / chaptersTotalDisplay));
  }, [chapterOrdinal, chaptersTotalDisplay, audioBarRatio]);

  const chapterSliceIndex = useMemo(() => {
    if (!currentChapter) return -1;
    const i = chapters.findIndex((c) => c.id === currentChapter.id);
    if (i >= 0) return i;
    return currentChapterIndex;
  }, [chapters, currentChapter, currentChapterIndex]);

  const autoAdvanceChapter = useMemo((): AudioChapterItem | null => {
    const nextFromIndex = chapters[chapterSliceIndex + 1];
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
      speech_text: undefined,
    };
  }, [readNav?.next, chapters, chapterSliceIndex]);

  const onPlaybackProgress = useCallback((current: number, dur: number, playing: boolean) => {
    if (!playing || dur <= 0) return;
    setAudioBarRatio(Math.min(1, Math.max(0, current / dur)));
  }, []);

  const onSeekComplete = useCallback((current: number, dur: number) => {
    if (dur <= 0) return;
    setAudioBarRatio(Math.min(1, Math.max(0, current / dur)));
  }, []);

  const goToChapter = useCallback(
    (index: number) => {
      const ch = chapters[index];
      if (!ch) return;
      loadedChapterIdRef.current = null;
      routerRef.current.replace(listenAudioPath(storySlug, ch), { scroll: false });
      setShowToc(false);
    },
    [chapters, storySlug],
  );

  const onChapterChange = useCallback(
    (id: number) => {
      const ch = chapters.find((c) => c.id === id);
      loadedChapterIdRef.current = null;
      routerRef.current.replace(ch ? listenAudioPath(storySlug, ch) : listenAudioPath(storySlug, { id, slug: null }), {
        scroll: false,
      });
    },
    [storySlug, chapters],
  );

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
            className="mt-4 inline-flex rounded-xl border border-indigo-200/70 bg-gradient-to-r from-white to-indigo-50/90 px-4 py-2 text-sm font-semibold text-indigo-900 shadow-sm transition hover:from-indigo-50 hover:to-violet-50 dark:border-indigo-800/60 dark:from-zinc-900 dark:to-indigo-950/50 dark:text-indigo-100 dark:hover:to-violet-950/35"
          >
            ← Về trang truyện
          </Link>
        </div>
      </div>
    );
  }

  const storyForLinks = { id: story.id, slug: storySlug };

  return (
    <div className={PAGE_FRAME}>
      <header className="z-20 shrink-0 border-b border-indigo-100/50 bg-white/90 px-3 py-2.5 shadow-[0_1px_0_rgba(99,102,241,0.06)] backdrop-blur-md dark:border-indigo-950/40 dark:bg-zinc-950/90 sm:px-4 sm:py-3 md:px-6">
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
                <span className="font-semibold text-indigo-600/90 dark:text-indigo-400">File audio</span>
                {" · "}
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
            {ttsSupported !== false ? (
              <Link
                href={storyListenHref(storyForLinks, currentChapter)}
                className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 text-xs font-semibold text-white shadow-md shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-teal-500 hover:shadow-emerald-500/35 dark:from-emerald-600 dark:to-teal-600 dark:shadow-emerald-900/40"
              >
                Giọng trình duyệt
              </Link>
            ) : (
              <span
                role="button"
                aria-disabled
                title="Trình duyệt không hỗ trợ đọc TTS (Web Speech API)"
                className="inline-flex h-11 shrink-0 cursor-not-allowed items-center justify-center whitespace-nowrap rounded-xl bg-zinc-300 px-3 text-xs font-semibold text-zinc-500 opacity-90 dark:bg-zinc-800 dark:text-zinc-500"
              >
                Giọng trình duyệt
              </span>
            )}
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

      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-stretch gap-2 overflow-hidden px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0.5rem))] md:px-6 md:pt-4 md:pb-[max(1rem,env(safe-area-inset-bottom,0.75rem))]">
        <div className="w-full shrink-0 sm:hidden">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/90 shadow-inner dark:bg-zinc-800"
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

        {audioUrl ? (
          <div className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center py-2">
            <AudioPlayer
              layout="audioweb"
              title={currentChapter.title}
              storyTitle={story.title}
              src={audioUrl}
              speechText={currentChapter.content}
              initialChapterId={currentChapter.id}
              audioPositionStorageKey={
                story?.id != null && currentChapter?.id != null
                  ? `story-audiofile:${story.id}:${currentChapter.id}`
                  : null
              }
              chapters={chapters.map((c) => ({
                id: c.id,
                title: c.title,
                audio_url: chapterAudioUrl(c),
                speech_text: c.content?.trim() ? c.content : undefined,
              }))}
              onChapterChange={onChapterChange}
              onPlaybackProgress={onPlaybackProgress}
              onSeekComplete={onSeekComplete}
              durationHintSec={currentChapter.duration > 0 ? currentChapter.duration : null}
              autoAdvanceChapter={autoAdvanceChapter}
            />
          </div>
        ) : (
          <div className={`${shell} mx-auto w-full max-w-lg space-y-4 p-8 text-center shadow-md`}>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Chương này chưa có file audio.</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Dùng trang đọc để xem chữ, hoặc nghe bằng giọng trình duyệt nếu bạn muốn.
            </p>
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Link
                href={storyReadHref(storyForLinks, currentChapter)}
                className="inline-flex w-full min-h-[2.75rem] items-center justify-center rounded-xl border border-indigo-200/70 bg-gradient-to-r from-white to-indigo-50/90 px-4 py-2.5 text-sm font-semibold text-indigo-900 shadow-sm transition hover:from-indigo-50 hover:to-violet-50 sm:w-auto dark:border-indigo-800/60 dark:from-zinc-900 dark:to-indigo-950/50 dark:text-indigo-100 dark:hover:to-violet-950/35"
              >
                Đọc chương
              </Link>
              {ttsSupported !== false ? (
                <Link
                  href={storyListenHref(storyForLinks, currentChapter)}
                  className="inline-flex w-full min-h-[2.75rem] items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500 hover:shadow-lg sm:w-auto dark:from-indigo-500 dark:to-violet-600 dark:shadow-indigo-900/40"
                >
                  Nghe (TTS)
                </Link>
              ) : (
                <span
                  role="button"
                  aria-disabled
                  title="Trình duyệt không hỗ trợ đọc TTS (Web Speech API)"
                  className="inline-flex w-full min-h-[2.75rem] cursor-not-allowed items-center justify-center rounded-xl bg-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-500 opacity-90 sm:w-auto dark:bg-zinc-800 dark:text-zinc-500"
                >
                  Nghe (TTS)
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ListenAudioStoryPageFallback() {
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

export default function ListenAudioStoryPage() {
  return (
    <Suspense fallback={<ListenAudioStoryPageFallback />}>
      <ListenAudioStoryPageContent />
    </Suspense>
  );
}
