"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { HomeStoryCard, type HomeStoryCardStory } from "@/components/HomeStoryCard";
import { apiFetch } from "@/lib/api";
import { inFlightDedupe } from "@/lib/inFlightDedupe";
import { STORIES_LIST_PER_PAGE } from "@/lib/storiesListConfig";

type StoryRow = HomeStoryCardStory;

export type StoriesListPaginated = {
  data: StoryRow[];
  current_page: number;
  last_page: number;
  per_page?: number;
  total?: number;
};

type StoriesListClientProps = {
  /** Trang hiện tại (đồng bộ `?page=`). */
  currentPage: number;
  /** Dữ liệu trang hiện tại từ server. `null` = lỗi SSR, client tự tải lại trang 1. */
  initialList: StoriesListPaginated | null;
};

function storiesListQuery(page: number): string {
  const q = new URLSearchParams({
    page: String(page),
    per_page: String(STORIES_LIST_PER_PAGE),
  });
  return `/api/stories?${q.toString()}`;
}

function StoriesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: STORIES_LIST_PER_PAGE }).map((_, i) => (
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

export function StoriesListClient({ currentPage, initialList }: StoriesListClientProps) {
  const [items, setItems] = useState<StoryRow[]>(() => initialList?.data ?? []);
  const [page, setPage] = useState(() => initialList?.current_page ?? currentPage);
  const [lastPage, setLastPage] = useState(() => initialList?.last_page ?? 1);
  const [total, setTotal] = useState(() => initialList?.total ?? initialList?.data?.length ?? 0);
  const [loading, setLoading] = useState(() => initialList === null);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (p: number) => {
    const json = await inFlightDedupe(`stories-list:p${p}:pp${STORIES_LIST_PER_PAGE}`, () =>
      apiFetch<StoriesListPaginated>(storiesListQuery(p)),
    );
    setLastPage(json.last_page ?? 1);
    setPage(json.current_page ?? p);
    setTotal(json.total ?? json.data.length);
    setItems(json.data);
  }, []);

  useEffect(() => {
    if (initialList !== null) {
      setItems(initialList.data);
      setPage(initialList.current_page ?? currentPage);
      setLastPage(initialList.last_page ?? 1);
      setTotal(initialList.total ?? initialList.data?.length ?? 0);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadPage(1);
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
  }, [loadPage, initialList, currentPage]);

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
    if ((total ?? 0) > 0) {
      return (
        <div className="rounded-2xl border border-dashed border-amber-200/90 bg-amber-50/40 px-6 py-10 text-center dark:border-amber-900/50 dark:bg-amber-950/25">
          <p className="text-sm text-amber-900 dark:text-amber-100">Không có truyện trên trang {page}.</p>
          <Link
            href="/stories?page=1"
            className="mt-3 inline-block text-sm font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            Về trang 1
          </Link>
        </div>
      );
    }
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
          {total > 0 ? (
            <>
              {total} truyện · Trang {page}/{lastPage}
            </>
          ) : (
            <>
              {items.length} trên trang · Trang {page}/{lastPage}
            </>
          )}
        </p>
      </div>

      <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((s) => (
          <li key={s.id} className="flex min-h-0 min-w-0">
            <HomeStoryCard story={s} />
          </li>
        ))}
      </ul>

      {lastPage > 1 ? (
        <nav
          className="flex flex-col items-center justify-between gap-4 border-t border-zinc-200/80 pt-6 dark:border-zinc-700/60 sm:flex-row"
          aria-label="Phân trang danh sách truyện"
        >
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 sm:text-left">
            {total > 0 ? (
              <>
                Hiển thị {(page - 1) * STORIES_LIST_PER_PAGE + 1}–{Math.min(page * STORIES_LIST_PER_PAGE, total)} /{" "}
                {total}
              </>
            ) : (
              <>Trang {page} / {lastPage}</>
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {page > 1 ? (
              <Link
                href={page === 2 ? "/stories" : `/stories?page=${page - 1}`}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-violet-300 hover:bg-violet-50/80 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-violet-700 dark:hover:bg-zinc-800"
              >
                ← Trước
              </Link>
            ) : (
              <span className="rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-zinc-400 opacity-60 dark:text-zinc-600">
                ← Trước
              </span>
            )}
            {page < lastPage ? (
              <Link
                href={`/stories?page=${page + 1}`}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-violet-300 hover:bg-violet-50/80 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-violet-700 dark:hover:bg-zinc-800"
              >
                Sau →
              </Link>
            ) : (
              <span className="rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-zinc-400 opacity-60 dark:text-zinc-600">
                Sau →
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
