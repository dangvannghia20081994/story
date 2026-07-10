"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { HomeStoryCard, type HomeStoryCardStory } from "@/components/HomeStoryCard";
import { fetchStoriesPage, type StoriesListPaginated } from "@/app/stories/actions";
import { inFlightDedupe } from "@/lib/inFlightDedupe";
import { STORIES_LIST_PER_PAGE } from "@/lib/storiesListConfig";
import { buildStoriesListHref, type StoriesListFilters } from "@/lib/storiesListQuery";

type StoryRow = HomeStoryCardStory;

export type { StoriesListPaginated };

type StoriesListClientProps = {
  /** Trang hiện tại (đồng bộ `?page=`). */
  currentPage: number;
  /** Bộ lọc đồng bộ query URL + API. */
  filters: StoriesListFilters;
  /** Dữ liệu trang hiện tại từ server. `null` = lỗi SSR, client tự tải lại trang 1. */
  initialList: StoriesListPaginated | null;
};

function storiesListDedupeKey(page: number, filters: StoriesListFilters): string {
  return `stories-list:p${page}:pp${STORIES_LIST_PER_PAGE}:${JSON.stringify(filters)}`;
}

function StoriesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {Array.from({ length: STORIES_LIST_PER_PAGE }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-line bg-paper-raised"
        >
          <div className="aspect-[16/10] animate-pulse bg-line" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 max-w-[14rem] animate-pulse rounded-md bg-line" />
            <div className="h-3 w-full animate-pulse rounded bg-line" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-line" />
            <div className="flex justify-between pt-2">
              <div className="h-6 w-24 animate-pulse rounded-lg bg-line" />
              <div className="h-4 w-16 animate-pulse rounded bg-line" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StoriesListClient({ currentPage, filters, initialList }: StoriesListClientProps) {
  const [items, setItems] = useState<StoryRow[]>(() => initialList?.data ?? []);
  const [page, setPage] = useState(() => initialList?.current_page ?? currentPage);
  const [lastPage, setLastPage] = useState(() => initialList?.last_page ?? 1);
  const [total, setTotal] = useState(() => initialList?.total ?? initialList?.data?.length ?? 0);
  const [loading, setLoading] = useState(() => initialList === null);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (p: number, f: StoriesListFilters) => {
    const json = await inFlightDedupe(storiesListDedupeKey(p, f), () =>
      fetchStoriesPage(p, f),
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
        await loadPage(1, filters);
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
  }, [loadPage, initialList, currentPage, filters]);

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
        <div className="rounded-2xl border border-dashed border-chusa/30 bg-chusa/10 px-6 py-10 text-center">
          <p className="font-serif text-sm text-ink-soft">Không có truyện trên trang {page}.</p>
          <Link
            href={buildStoriesListHref(1, filters)}
            className="mt-3 inline-block text-sm font-semibold text-chusa underline-offset-2 hover:underline hover:text-chusa-deep"
          >
            Về trang 1
          </Link>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-dashed border-line bg-paper-inset px-6 py-14 text-center">
        <p className="font-serif text-lg italic text-ink-faint">Chưa có truyện nào</p>
        <p className="mt-2 text-sm text-ink-faint">
          Dùng nút <span className="font-medium text-chusa">Thêm truyện</span> phía trên để tạo
          bản ghi đầu tiên.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-chusa">
            Thư viện
          </p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink">Tất cả truyện</h2>
        </div>
        <p className="text-sm text-ink-faint">
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

      <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {items.map((s) => (
          <li key={s.id} className="flex min-h-0 min-w-0">
            <HomeStoryCard story={s} />
          </li>
        ))}
      </ul>

      {lastPage > 1 ? (
        <nav
          className="flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row"
          aria-label="Phân trang danh sách truyện"
        >
          <p className="text-center text-sm text-ink-faint sm:text-left">
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
                href={buildStoriesListHref(page - 1, filters)}
                className="rounded-lg border border-line bg-paper-raised px-4 py-2 text-sm font-semibold text-ink transition hover:border-chusa/40 hover:text-chusa focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chusa"
              >
                ← Trước
              </Link>
            ) : (
              <span className="rounded-lg border border-transparent px-4 py-2 text-sm font-semibold text-ink-faint opacity-60">
                ← Trước
              </span>
            )}
            {page < lastPage ? (
              <Link
                href={buildStoriesListHref(page + 1, filters)}
                className="rounded-lg border border-line bg-paper-raised px-4 py-2 text-sm font-semibold text-ink transition hover:border-chusa/40 hover:text-chusa focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chusa"
              >
                Sau →
              </Link>
            ) : (
              <span className="rounded-lg border border-transparent px-4 py-2 text-sm font-semibold text-ink-faint opacity-60">
                Sau →
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
