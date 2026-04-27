"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { storyDetailHref } from "@/lib/storyPath";

type StoryRow = {
  id: number;
  slug: string | null;
  title: string;
  tts_status: string;
  audio_url: string | null;
};

type Paginated = {
  data: StoryRow[];
  current_page: number;
  last_page: number;
};

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
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Đang tải danh sách…</p>;
  }

  if (error) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        Không tải được danh sách: {error}
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Chưa có truyện. Dùng nút Thêm truyện phía trên để tạo mới.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {items.map((s) => {
          const sampleSrc = resolvePlayableAudioUrl(s.audio_url, null);
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <Link
                  href={storyDetailHref(s)}
                  className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                >
                  {s.title}
                </Link>
                <p className="text-xs text-zinc-500">
                  Audio:{" "}
                  {s.tts_status === "completed"
                    ? "đã có"
                    : s.tts_status === "processing"
                      ? "đang xử lý"
                      : "chưa có"}
                </p>
              </div>
              {sampleSrc ? (
                <audio controls preload="none" className="h-8 max-w-full">
                  <source src={sampleSrc} type="audio/mpeg" />
                </audio>
              ) : (
                <span className="text-xs text-zinc-400">Chưa có audio</span>
              )}
            </li>
          );
        })}
      </ul>
      {page < lastPage ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {loadingMore ? "Đang tải…" : "Tải thêm truyện"}
        </button>
      ) : null}
    </div>
  );
}
