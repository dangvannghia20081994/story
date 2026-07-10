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
      <div className="paper-card p-5">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-chusa">Lọc truyện</h2>
        <p className="mt-1 text-xs text-ink-faint">Chọn tiêu chí rồi nhấn áp dụng — URL cập nhật để có thể chia sẻ.</p>

        <div className="mt-5 space-y-5">
          <div>
            <label htmlFor="stories-filter-q" className="block text-xs font-semibold text-ink-soft">
              Tên truyện
            </label>
            <input
              id="stories-filter-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tiêu đề…"
              maxLength={200}
              className="mt-1.5 w-full rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none ring-chusa/30 placeholder:text-ink-faint focus:border-chusa/50 focus:ring-2"
            />
          </div>

          <fieldset className="space-y-2 border-0 p-0">
            <legend className="text-xs font-semibold text-ink-soft">Thể loại</legend>
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
                      className="h-4 w-4 rounded border-line text-chusa focus:ring-chusa"
                    />
                    <label htmlFor={id} className="text-sm text-ink">
                      {GENRE_LABELS[slug] ?? slug}
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] leading-snug text-ink-faint">Truyện có ít nhất một thể loại đã chọn.</p>
          </fieldset>

          <div>
            <label htmlFor="stories-serial" className="block text-xs font-semibold text-ink-soft">
              Tình trạng
            </label>
            <select
              id="stories-serial"
              value={serialStatus}
              onChange={(e) => setSerialStatus(e.target.value as StoriesListFilters["serial_status"])}
              className="mt-1.5 w-full rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none focus:border-chusa/50 focus:ring-2 focus:ring-chusa/30"
            >
              <option value="">Tất cả</option>
              <option value="ongoing">Đang ra</option>
              <option value="completed">Hoàn thành</option>
            </select>
          </div>

          <div>
            <label htmlFor="stories-audio" className="block text-xs font-semibold text-ink-soft">
              Có audio
            </label>
            <select
              id="stories-audio"
              value={hasAudio}
              onChange={(e) => setHasAudio(e.target.value as StoriesListFilters["has_audio"])}
              className="mt-1.5 w-full rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none focus:border-chusa/50 focus:ring-2 focus:ring-chusa/30"
            >
              <option value="">Tất cả</option>
              <option value="yes">Có ít nhất một chương có audio</option>
              <option value="no">Chưa có chương nào có audio</option>
            </select>
          </div>

          <div>
            <label htmlFor="stories-sort" className="block text-xs font-semibold text-ink-soft">
              Ngày tạo
            </label>
            <select
              id="stories-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as StoriesListSort)}
              className="mt-1.5 w-full rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none focus:border-chusa/50 focus:ring-2 focus:ring-chusa/30"
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
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-chusa px-4 py-2.5 text-sm font-semibold text-[#f6ede0] transition hover:bg-chusa-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chusa"
          >
            Áp dụng bộ lọc
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-line bg-paper-raised px-4 py-2.5 text-sm font-medium text-ink transition hover:border-chusa/40 hover:text-chusa focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chusa"
          >
            Xóa lọc
          </button>
        </div>
        {dirty ? (
          <p className="mt-2 text-[11px] text-chusa">Bạn đã chỉnh bộ lọc — nhấn áp dụng để tải kết quả.</p>
        ) : null}
      </div>
    </aside>
  );
}
