"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { GENRE_LABELS, STORY_GENRE_SLUGS, type StoryGenreSlug } from "@/lib/genreLabels";
import { buildStoriesListHref, type StoriesListFilters, type StoriesListSort } from "@/lib/storiesListQuery";

type Props = {
  filters: StoriesListFilters;
};

export function StoriesListSidebar({ filters }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q);
  const [genres, setGenres] = useState<StoryGenreSlug[]>(() => [...filters.genres]);
  const [serialStatus, setSerialStatus] = useState<StoriesListFilters["serial_status"]>(filters.serial_status);
  const [hasAudio, setHasAudio] = useState<StoriesListFilters["has_audio"]>(filters.has_audio);
  const [sort, setSort] = useState<StoriesListSort>(filters.sort);

  useEffect(() => {
    setQ(filters.q);
    setGenres([...filters.genres]);
    setSerialStatus(filters.serial_status);
    setHasAudio(filters.has_audio);
    setSort(filters.sort);
  }, [filters]);

  const toggleGenre = useCallback((slug: StoryGenreSlug) => {
    setGenres((prev) => (prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]));
  }, []);

  const apply = useCallback(() => {
    const next: StoriesListFilters = {
      q: q.trim(),
      genres: [...genres],
      serial_status: serialStatus,
      has_audio: hasAudio,
      sort,
    };
    router.push(buildStoriesListHref(1, next));
  }, [router, q, genres, serialStatus, hasAudio, sort]);

  const reset = useCallback(() => {
    router.push("/stories");
  }, [router]);

  const dirty =
    q.trim() !== filters.q ||
    genres.length !== filters.genres.length ||
    !genres.every((g, i) => g === filters.genres[i]) ||
    serialStatus !== filters.serial_status ||
    hasAudio !== filters.has_audio ||
    sort !== filters.sort;

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-64 xl:w-72">
      <div className="rounded-2xl border border-zinc-200/90 bg-white/90 p-5 shadow-sm dark:border-zinc-700/70 dark:bg-zinc-900/50">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">Lọc truyện</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Chọn tiêu chí rồi nhấn áp dụng — URL cập nhật để có thể chia sẻ.</p>

        <div className="mt-5 space-y-5">
          <div>
            <label htmlFor="stories-filter-q" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Tên truyện
            </label>
            <input
              id="stories-filter-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tiêu đề…"
              maxLength={200}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-violet-500/30 placeholder:text-zinc-400 focus:border-violet-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>

          <fieldset className="space-y-2 border-0 p-0">
            <legend className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Thể loại</legend>
            <ul className="mt-1.5 list-none space-y-2 p-0">
              {STORY_GENRE_SLUGS.map((slug) => {
                const id = `stories-genre-${slug}`;
                return (
                  <li key={slug} className="flex items-center gap-2">
                    <input
                      id={id}
                      type="checkbox"
                      checked={genres.includes(slug)}
                      onChange={() => toggleGenre(slug)}
                      className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-900"
                    />
                    <label htmlFor={id} className="text-sm text-zinc-800 dark:text-zinc-200">
                      {GENRE_LABELS[slug] ?? slug}
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">Truyện có ít nhất một thể loại đã chọn.</p>
          </fieldset>

          <div>
            <label htmlFor="stories-serial" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Tình trạng
            </label>
            <select
              id="stories-serial"
              value={serialStatus}
              onChange={(e) => setSerialStatus(e.target.value as StoriesListFilters["serial_status"])}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="">Tất cả</option>
              <option value="ongoing">Đang ra</option>
              <option value="completed">Hoàn thành</option>
            </select>
          </div>

          <div>
            <label htmlFor="stories-audio" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Có audio
            </label>
            <select
              id="stories-audio"
              value={hasAudio}
              onChange={(e) => setHasAudio(e.target.value as StoriesListFilters["has_audio"])}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="">Tất cả</option>
              <option value="yes">Có ít nhất một chương có audio</option>
              <option value="no">Chưa có chương nào có audio</option>
            </select>
          </div>

          <div>
            <label htmlFor="stories-sort" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Ngày tạo
            </label>
            <select
              id="stories-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as StoriesListSort)}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="created_desc">Mới nhất trước</option>
              <option value="created_asc">Cũ nhất trước</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={apply}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            Áp dụng bộ lọc
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Xóa lọc
          </button>
        </div>
        {dirty ? (
          <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300/90">Bạn đã chỉnh bộ lọc — nhấn áp dụng để tải kết quả.</p>
        ) : null}
      </div>
    </aside>
  );
}
