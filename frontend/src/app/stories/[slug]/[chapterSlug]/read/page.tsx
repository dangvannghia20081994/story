"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { isSpeechSynthesisSupported } from "@/lib/browserSpeech";
import { fetchChaptersToc, fetchReadSlice } from "@/app/stories/actions";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { inFlightDedupe } from "@/lib/inFlightDedupe";
import { getSavedChapterId, setSavedChapterRef } from "@/lib/readingProgress";
import {
  chapterKey,
  resolveChapterForHref,
  storyDetailHref,
  storyListenAudioHref,
  storyListenHref,
} from "@/lib/storyPath";
import { useChapterPlainWithLexicons } from "@/contexts/LexiconContext";
import { speakerPigment } from "@/lib/speakerColors";
import { Seal } from "@/components/Seal";

type ContentSegment = {
  speaker: string;
  text: string;
  character_id?: number | null;
};

type Chapter = {
  id: number;
  title: string;
  slug?: string | null;
  content: string;
  content_segments?: ContentSegment[] | null;
  audio_multiple_path: string | null;
  audio_single_url?: string | null;
  duration: number;
  chapter_number?: number | null;
};

type ReadNav = {
  chapter_index: number;
  chapters_total: number;
  prev: { id: number; title: string; slug?: string | null; audio_single_url?: string | null; duration?: number } | null;
  next: { id: number; title: string; slug?: string | null; audio_single_url?: string | null; duration?: number } | null;
};

type Story = {
  id: number;
  title: string;
  slug?: string | null;
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

const shell = "paper-card";

/** Không chiếm thêm chiều cao trong flow (tránh nav + 100dvh → 2 scrollbar); trùng với `top-14` của Navbar. */
const readViewportFrame =
  "fixed inset-x-0 bottom-0 top-14 z-0 flex min-h-0 flex-col overflow-hidden overscroll-none";

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

function resolveChapterSlugForInitialLoad(storySlug: string, list: Chapter[], urlChapterSlug: string): string {
  const trimmed = urlChapterSlug.trim();
  if (trimmed !== "") {
    const bySlug = list.find((c) => chapterKey(c) === trimmed);
    if (bySlug) return chapterKey(bySlug);
    const asId = parseInt(trimmed, 10);
    if (Number.isFinite(asId)) {
      const byId = list.find((c) => c.id === asId);
      if (byId) return chapterKey(byId);
    }
    // Không có trong page 1 nhưng URL có slug/id rõ ràng — tin URL, API sẽ resolve đúng.
    return trimmed;
  }
  const saved = getSavedChapterId(storySlug);
  if (saved != null) {
    const hit = list.find((c) => c.id === saved);
    if (hit) return chapterKey(hit);
  }
  return list[0] ? chapterKey(list[0]) : "";
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


function chapterAudioUrl(c: Chapter | undefined): string | null {
  if (!c) return null;
  return resolvePlayableAudioUrl(c.audio_single_url, c.audio_multiple_path);
}

function readPath(storySlug: string, ch: { id: number; slug?: string | null }): string {
  return `/${encodeURIComponent(storySlug)}/${encodeURIComponent(chapterKey(ch))}/read`;
}

function ReadStoryPageContent() {
  const params = useParams();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const rawStory = params?.slug;
  const rawChapter = params?.chapterSlug;
  const storySlug = Array.isArray(rawStory) ? (rawStory[0] ?? "") : (rawStory ?? "");
  const chapterSlug = Array.isArray(rawChapter) ? (rawChapter[0] ?? "") : (rawChapter ?? "");

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
  const loadedRouteKeyRef = useRef<string | null>(null);
  const tocListRef = useRef<HTMLUListElement>(null);

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
        slug: nav.prev.slug ?? null,
        content: "",
        audio_multiple_path: null,
        duration: nav.prev.duration ?? 0,
        audio_single_url: nav.prev.audio_single_url ?? null,
      });
    }
    if (nav?.next) {
      stubs.push({
        id: nav.next.id,
        title: nav.next.title,
        slug: nav.next.slug ?? null,
        content: "",
        audio_multiple_path: null,
        duration: nav.next.duration ?? 0,
        audio_single_url: nav.next.audio_single_url ?? null,
      });
    }

    const merged = mergeChapterList(prevList, [...stubs, { ...rc, content: rc.content ?? "" }]);
    const idx = merged.findIndex((c) => c.id === rc.id);
    return { chapters: merged, index: idx >= 0 ? idx : 0 };
  }

  useEffect(() => {
    setChapters([]);
    chaptersRef.current = [];
    loadedRouteKeyRef.current = null;
  }, [storySlug]);

  useEffect(() => {
    if (!storySlug || !chapterSlug) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const routeKey = `${storySlug}|${chapterSlug}`;

    async function run() {
      if (chaptersRef.current.length > 0 && loadedRouteKeyRef.current === routeKey) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        if (chaptersRef.current.length === 0) {
          const toc = await inFlightDedupe(`story-toc:${storySlug}:p1`, () => fetchChaptersToc(storySlug, 1));
          if (cancelled) return;
          const shellList = toc.data.map((c) => ({ ...c, content: "" }));
          setChapters(shellList);
          chaptersRef.current = shellList;
          setTocLastPage(toc.last_page ?? 1);
          setTocLoadedPage(1);

          const targetSlug = resolveChapterSlugForInitialLoad(storySlug, shellList, chapterSlug);
          if (targetSlug === "") {
            setStory(null);
            setReadNav(null);
            return;
          }

          const slice = await inFlightDedupe(`story-read-slug:${storySlug}:${targetSlug}`, () =>
            fetchReadSlice(storySlug, targetSlug),
          );
          if (cancelled) return;
          const { chapters: merged, index } = applySliceToList(shellList, slice);
          setChapters(merged);
          chaptersRef.current = merged;
          setStory(slice);
          setReadNav(slice.read_navigation ?? null);
          setCurrentChapterIndex(index);
          const canonical = slice.read_chapter ? chapterKey(slice.read_chapter) : targetSlug;
          loadedRouteKeyRef.current = `${storySlug}|${canonical}`;
          if (typeof window !== "undefined" && canonical !== chapterSlug) {
            routerRef.current.replace(readPath(storySlug, slice.read_chapter!), { scroll: false });
          }
          return;
        }

        const slice = await inFlightDedupe(`story-read-slug:${storySlug}:${chapterSlug}`, () =>
          fetchReadSlice(storySlug, chapterSlug),
        );
        if (cancelled) return;
        const { chapters: merged, index } = applySliceToList(chaptersRef.current, slice);
        setChapters(merged);
        chaptersRef.current = merged;
        setCurrentChapterIndex(index);
        setStory(slice);
        setReadNav(slice.read_navigation ?? null);
        const canonical = slice.read_chapter ? chapterKey(slice.read_chapter) : chapterSlug;
        loadedRouteKeyRef.current = `${storySlug}|${canonical}`;
        if (typeof window !== "undefined" && canonical !== chapterSlug) {
          routerRef.current.replace(readPath(storySlug, slice.read_chapter!), { scroll: false });
        }
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
  }, [storySlug, chapterSlug]);

  const loadMoreToc = useCallback(async () => {
    if (!storySlug || loadingTocMore || tocLoadedPage >= tocLastPage) return;
    setLoadingTocMore(true);
    try {
      const nextPage = tocLoadedPage + 1;
      const toc = await inFlightDedupe(`story-toc:${storySlug}:p${nextPage}`, () => fetchChaptersToc(storySlug, nextPage));
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
    if (!showToc) return;
    let cancelled = false;

    async function loadAndScroll() {
      const chapterIdx = readNav?.chapter_index;
      if (chapterIdx) {
        const neededPage = Math.ceil(chapterIdx / 100);
        let loadedPage = tocLoadedPage;
        while (loadedPage < neededPage && loadedPage < tocLastPage && !cancelled) {
          const nextPage = loadedPage + 1;
          try {
            const toc = await fetchChaptersToc(storySlug, nextPage);
            if (cancelled) return;
            const batch = toc.data.map((c) => ({ ...c, content: "" as string }));
            setChapters((prev) => mergeChapterList(prev, batch));
            setTocLoadedPage(nextPage);
            setTocLastPage(toc.last_page ?? tocLastPage);
            loadedPage = nextPage;
          } catch {
            break;
          }
        }
      }
      if (!cancelled) {
        window.setTimeout(() => {
          const active = tocListRef.current?.querySelector("[data-current='true']") as HTMLElement | null;
          active?.scrollIntoView({ block: "center", behavior: "instant" });
        }, 50);
      }
    }

    void loadAndScroll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToc]);

  const currentChapter = useMemo(() => {
    const bySlug = chapters.find((c) => chapterKey(c) === chapterSlug);
    if (bySlug) return bySlug;
    const asId = parseInt(chapterSlug, 10);
    if (Number.isFinite(asId)) {
      const hit = chapters.find((c) => c.id === asId);
      if (hit) return hit;
    }
    return chapters[currentChapterIndex];
  }, [chapters, chapterSlug, currentChapterIndex]);

  useEffect(() => {
    if (!storySlug || loading) return;
    const ch = currentChapter;
    if (!ch?.id || !Number.isFinite(ch.id)) return;
    setSavedChapterRef(storySlug, { id: ch.id, slug: ch.slug });
  }, [storySlug, loading, currentChapter]);

  const readDisplayPlain = useChapterPlainWithLexicons(currentChapter?.content ?? "");

  const chaptersTotalDisplay = readNav?.chapters_total ?? chapters.length;
  const chapterOrdinal = readNav?.chapter_index ?? currentChapterIndex + 1;

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
    const stub = readNav?.prev ?? chapters[currentChapterIndex - 1];
    const prev = resolveChapterForHref(stub, chapters);
    if (!prev?.id) return;
    loadedRouteKeyRef.current = null;
    routerRef.current.replace(readPath(storySlug, prev), { scroll: false });
    scrollReadPaneToTop("smooth");
  }, [readNav?.prev, chapters, currentChapterIndex, storySlug, scrollReadPaneToTop]);

  const goToNext = useCallback(() => {
    const stub = readNav?.next ?? chapters[currentChapterIndex + 1];
    const next = resolveChapterForHref(stub, chapters);
    if (!next?.id) return;
    loadedRouteKeyRef.current = null;
    routerRef.current.replace(readPath(storySlug, next), { scroll: false });
    scrollReadPaneToTop("smooth");
  }, [readNav?.next, chapters, currentChapterIndex, storySlug, scrollReadPaneToTop]);

  const goToChapter = useCallback(
    (index: number) => {
      const ch = chapters[index];
      if (!ch) return;
      loadedRouteKeyRef.current = null;
      routerRef.current.replace(readPath(storySlug, ch), { scroll: false });
      setShowToc(false);
      scrollReadPaneToTop("smooth");
    },
    [chapters, storySlug, scrollReadPaneToTop],
  );

  if (loading) {
    return (
      <div className={`${readViewportFrame} items-center justify-center px-4`}>
        <div className={`${shell} w-full max-w-md space-y-4 p-8`}>
          <div className="h-2 w-3/4 animate-pulse rounded-full bg-line" />
          <div className="h-2 w-full animate-pulse rounded-full bg-line" />
          <div className="h-2 w-5/6 animate-pulse rounded-full bg-line" />
          <p className="pt-2 text-center font-serif text-sm text-ink-faint">Đang tải truyện…</p>
        </div>
      </div>
    );
  }

  if (!storySlug || !chapterSlug) {
    return (
      <div className={`${readViewportFrame} items-center justify-center gap-4 px-4`}>
        <div className={`${shell} max-w-md p-8 text-center`}>
          <p className="font-serif text-sm text-ink-soft">Thiếu đường dẫn truyện hoặc chương.</p>
        </div>
      </div>
    );
  }

  if (!story || chapters.length === 0 || !currentChapter) {
    return (
      <div className={`${readViewportFrame} items-center justify-center gap-4 px-4`}>
        <div className={`${shell} max-w-md p-8 text-center`}>
          <p className="font-serif text-sm text-ink-soft">Không tìm thấy truyện hoặc chưa có chương.</p>
          <Link
            href={storyDetailHref({ id: story?.id ?? 0, slug: storySlug })}
            className="mt-4 inline-flex rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-chusa/40 hover:text-chusa"
          >
            ← Về trang truyện
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={readViewportFrame}>
      <header className="z-20 shrink-0 border-b border-line bg-paper/90 px-3 py-2.5 backdrop-blur-md sm:px-4 sm:py-3 md:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 w-full items-center gap-2 sm:flex-1 sm:gap-3">
            <Link
              href={storyDetailHref({ id: story?.id ?? 0, slug: storySlug })}
              className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-line bg-paper-raised px-3 text-xs font-medium text-ink-soft transition hover:border-chusa/40 hover:text-chusa sm:text-sm"
            >
              ← Truyện
            </Link>
            <div className="hidden h-6 w-px shrink-0 self-center bg-line sm:block" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-display text-sm font-bold leading-snug text-ink sm:truncate sm:leading-normal">
                {story.title}
              </p>
              <p className="mt-0.5 line-clamp-2 font-serif text-xs leading-snug text-ink-faint sm:truncate sm:leading-normal">
                Chương {chapterOrdinal}/{chaptersTotalDisplay}
                {currentChapter ? ` · ${currentChapter.title}` : ""}
              </p>
            </div>
          </div>
          <div className="flex w-full min-w-0 shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
            {ttsSupported !== false ? (
              <Link
                href={storyListenHref(storyForListenLinks, currentChapter)}
                className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-chusa/25 bg-chusa/10 px-3 text-xs font-semibold text-chusa transition hover:border-chusa/50 hover:bg-chusa/15 sm:text-sm"
              >
                Nghe (TTS)
              </Link>
            ) : (
              <span
                role="button"
                aria-disabled
                title="Trình duyệt không hỗ trợ đọc TTS (Web Speech API)"
                className="inline-flex h-11 shrink-0 cursor-not-allowed items-center justify-center whitespace-nowrap rounded-lg border border-line bg-paper-inset px-3 text-xs font-semibold text-ink-faint opacity-80 sm:text-sm"
              >
                Nghe (TTS)
              </span>
            )}
            {readChapterAudioUrl ? (
              <Link
                href={storyListenAudioHref(storyForListenLinks, currentChapter)}
                className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-ngoc/25 bg-ngoc/10 px-3 text-xs font-semibold text-ngoc transition hover:border-ngoc/50 hover:bg-ngoc/15 sm:text-sm"
              >
                Nghe audio
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setShowToc((v) => !v)}
              className={`inline-flex h-11 min-w-0 flex-1 items-center rounded-lg border px-3 text-left text-xs font-semibold transition sm:max-w-[min(100%,18rem)] sm:flex-none sm:text-sm ${
                showToc
                  ? "border-chusa/40 bg-chusa/10 text-chusa"
                  : "border-line bg-paper-raised text-ink hover:border-chusa/30"
              }`}
              aria-expanded={showToc}
            >
              <span className="flex min-w-0 flex-1 items-center gap-0">
                <span className="shrink-0 text-ink-faint">Mục lục · </span>
                <span className="min-w-0 truncate">{currentChapter?.title ?? "Chương"}</span>
              </span>
            </button>
            <div className="flex h-11 shrink-0 items-stretch overflow-hidden rounded-lg border border-line bg-paper-raised">
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                className="inline-flex min-w-[2.25rem] items-center justify-center px-2 text-xs font-semibold text-ink-soft transition hover:bg-paper-inset hover:text-chusa"
                aria-label="Giảm cỡ chữ"
              >
                A-
              </button>
              <span className="flex min-w-[1.75rem] items-center justify-center border-x border-line bg-paper-inset text-[10px] font-medium tabular-nums text-ink-faint">
                {fontSize}
              </span>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(28, s + 2))}
                className="inline-flex min-w-[2.25rem] items-center justify-center px-2 text-xs font-semibold text-ink-soft transition hover:bg-paper-inset hover:text-chusa"
                aria-label="Tăng cỡ chữ"
              >
                A+
              </button>
            </div>
          </div>
        </div>
        {/* thanh chỉ đọc — vị trí chương trong truyện */}
        <div className="mx-auto mt-2.5 h-[2px] w-full max-w-4xl overflow-hidden rounded-full bg-line/60" aria-hidden>
          <div
            className="h-full rounded-full bg-chusa transition-[width] duration-500"
            style={{ width: `${Math.max(3, Math.min(100, (chapterOrdinal / Math.max(1, chaptersTotalDisplay)) * 100))}%` }}
          />
        </div>
      </header>

      {showToc ? (
        <>
          <button
            type="button"
            className="fixed inset-x-0 bottom-0 top-14 z-40 bg-ink/40 backdrop-blur-[2px]"
            aria-label="Đóng mục lục"
            onClick={() => setShowToc(false)}
          />
          <div className="fixed left-4 right-4 top-28 z-50 mx-auto flex max-h-[min(70vh,28rem)] max-w-md flex-col overflow-hidden rounded-xl border border-line bg-paper-raised shadow-[0_24px_60px_-24px_rgba(33,30,26,0.6)] md:left-auto md:right-8 md:mx-0">
            <div className="shrink-0 border-b border-line px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
                Mục lục · {chapters.length}/{chaptersTotalDisplay} chương
              </h3>
            </div>
            <ul ref={tocListRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {chapters.map((chapter, index) => {
                const isCurrent = chapter.id === currentChapter?.id;
                return (
                  <li key={chapter.id} data-current={isCurrent ? "true" : undefined}>
                    <button
                      type="button"
                      onClick={() => goToChapter(index)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        isCurrent
                          ? "bg-chusa/10 font-semibold text-chusa"
                          : "text-ink-soft hover:bg-paper-inset hover:text-ink"
                      }`}
                    >
                      {isCurrent ? (
                        <Seal size={26} className="!rotate-0" />
                      ) : (
                        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-paper-inset text-xs font-bold tabular-nums text-ink-faint">
                          {index + 1}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 font-serif leading-snug">{chapter.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {tocLoadedPage < tocLastPage ? (
              <div className="shrink-0 border-t border-line p-2">
                <button
                  type="button"
                  onClick={() => void loadMoreToc()}
                  disabled={loadingTocMore}
                  className="w-full rounded-lg border border-line bg-paper py-2.5 text-xs font-semibold text-ink transition hover:border-chusa/30 hover:text-chusa disabled:opacity-60"
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
        <article className={`relative z-0 ${shell} mx-auto max-w-3xl px-6 py-9 md:px-12 md:py-12`}>
          {/* đầu chương: con dấu + số chương + tên chương */}
          <div className="mb-9 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-ink-faint">
              <span className="h-px w-8 bg-line" aria-hidden />
              Hồi {chapterOrdinal}
              <span className="h-px w-8 bg-line" aria-hidden />
            </div>
            <h2
              className="font-display font-bold leading-snug text-ink"
              style={{ fontSize: `${Math.min(fontSize + 4, 26)}px` }}
            >
              {currentChapter.title}
            </h2>
          </div>

          <div
            className="text-pretty font-serif leading-[1.9] text-ink selection:bg-chusa/20"
            style={{ fontSize: `${fontSize}px` }}
          >
            {currentChapter.content_segments?.length ? (
              <div className="space-y-4">
                {currentChapter.content_segments.map((seg, i) => {
                  const isCharacter = seg.speaker !== "narration" && seg.speaker !== "_unknown";
                  const isUnknown = seg.speaker === "_unknown";
                  const isDialogue = isCharacter || isUnknown;
                  const rawText = seg.text ?? "";
                  const stripped = rawText.replace(/^[\s"“”]+/, "").replace(/[\s"“”]+$/, "");
                  const displayText = isDialogue ? `“${stripped}”` : rawText;

                  if (seg.speaker === "narration") {
                    return (
                      <p key={i} className="italic text-ink-soft">
                        {rawText}
                      </p>
                    );
                  }

                  // Lời thoại — mỗi nhân vật một sắc mực (voice-cast)
                  const pigment = isCharacter ? speakerPigment(seg.speaker) : "var(--ink-faint)";
                  return (
                    <p
                      key={i}
                      className="border-l-2 pl-4"
                      style={{ borderColor: pigment }}
                    >
                      {isCharacter ? (
                        <span
                          className="mb-0.5 block font-display text-[0.7em] font-bold uppercase tracking-wide"
                          style={{ color: pigment }}
                        >
                          {seg.speaker}
                        </span>
                      ) : null}
                      <span className="text-ink">{displayText}</span>
                    </p>
                  );
                })}
              </div>
            ) : (
              <div className="whitespace-pre-wrap">{readDisplayPlain}</div>
            )}
          </div>

          {/* dấu kết chương */}
          <div className="mt-10 flex justify-center">
            <Seal size={30} className="!rotate-0 opacity-80" glyph="終" title="Hết hồi" />
          </div>
        </article>
      </main>

      <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center justify-between gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:px-8">
        <button
          type="button"
          onClick={goToPrev}
          disabled={!hasPrev}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition md:px-4 md:py-2 md:text-sm ${
            hasPrev
              ? "border border-line bg-paper-raised text-ink hover:border-chusa/40 hover:text-chusa"
              : "cursor-not-allowed border border-transparent text-ink-faint/50"
          }`}
        >
          ← Trước
        </button>
        <span className="rounded-full border border-line bg-paper-raised px-2.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-soft md:px-3 md:py-1 md:text-xs">
          {chapterOrdinal} / {chaptersTotalDisplay}
        </span>
        <button
          type="button"
          onClick={goToNext}
          disabled={!hasNext}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition md:px-4 md:py-2 md:text-sm ${
            hasNext
              ? "border border-line bg-paper-raised text-ink hover:border-chusa/40 hover:text-chusa"
              : "cursor-not-allowed border border-transparent text-ink-faint/50"
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
    <div className={`${readViewportFrame} items-center justify-center px-4`}>
      <div className={`${shell} w-full max-w-md space-y-4 p-8`}>
        <div className="h-2 w-3/4 animate-pulse rounded-full bg-line" />
        <div className="h-2 w-full animate-pulse rounded-full bg-line" />
        <div className="h-2 w-5/6 animate-pulse rounded-full bg-line" />
        <p className="pt-2 text-center font-serif text-sm text-ink-faint">Đang tải…</p>
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
