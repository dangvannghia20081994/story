"use client";

import { useCallback, useEffect, useState } from "react";

import { HomeStoryCard, type HomeStoryCardStory } from "@/components/HomeStoryCard";
import { apiFetch } from "@/lib/api";

type StoryRow = HomeStoryCardStory;

type Paginated = {
  data: StoryRow[];
  current_page: number;
  last_page: number;
};

function StoriesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/80 dark:border-zinc-700/60 dark:bg-zinc-800/40"
        >
          <div className="aspect-[16/10] animate-pulse bg-gradient-to-br from-zinc-200 to-zinc-100 dark:from-zinc-800 dark:to-zinc-900" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 max-w-[14rem] animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="flex justify-between pt-2">
              <div className="h-6 w-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StoriesListClient() {
  const [items, setItems] = useState<StoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (p: number, append: boolean) => {
    const json = await apiFetch<Paginated>(`/api/stories?page=${p}`);
    setLastPage(json.last_page ?? 1);
    setPage(json.current_page ?? p);
    if (append) {
      setItems((prev) => [...prev, ...json.data]);
    } else {
      setItems(json.data);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadPage(1, false);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= lastPage) return;
    setLoadingMore(true);
    setError(null);
    try {
      await loadPage(page + 1, true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadPage, loadingMore, page, lastPage]);

  if (loading) {
    return <StoriesGridSkeleton />;
  }

  if (error) {
    return (
      <section className="rounded-xl border border-red-200/90 bg-red-50/95 p-5 text-sm text-red-800 dark:border-red-900/80 dark:bg-red-950/60 dark:text-red-200">
        Không tải được danh sách: {error}
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300/90 bg-zinc-50/50 px-6 py-14 text-center dark:border-zinc-600 dark:bg-zinc-900/30">
        <p className="text-lg text-zinc-600 dark:text-zinc-300">Chưa có truyện nào</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
          Dùng nút <span className="font-medium text-violet-600 dark:text-violet-400">Thêm truyện</span> phía trên để tạo
          bản ghi đầu tiên.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-400/90">
            Thư viện
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Tất cả truyện</h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {items.length} truyện{page < lastPage ? " (đang xem một phần)" : ""}
        </p>
      </div>

      <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((s) => (
          <li key={s.id} className="min-w-0">
            <HomeStoryCard story={s} />
          </li>
        ))}
      </ul>

      {page < lastPage ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="group relative overflow-hidden rounded-2xl border border-violet-300/60 bg-white/90 px-8 py-3 text-sm font-semibold text-violet-800 shadow-sm transition hover:border-violet-400 hover:shadow-md disabled:opacity-60 dark:border-violet-500/35 dark:bg-zinc-900/80 dark:text-violet-200 dark:hover:border-violet-400/50 dark:hover:bg-zinc-800/90"
          >
            <span className="relative z-10">{loadingMore ? "Đang tải…" : "Tải thêm truyện"}</span>
            <span
              className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
              aria-hidden
            >
              <span className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-indigo-500/10" />
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
