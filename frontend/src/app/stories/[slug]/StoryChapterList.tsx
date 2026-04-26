"use client";

import Link from "next/link";
import { storyReadHref } from "@/lib/storyPath";

export type StoryChapterListRow = {
  id: number;
  title: string;
  created_at?: string;
  updated_at?: string;
};

function chapterListDateTime(c: StoryChapterListRow): string {
  const raw = c.created_at ?? c.updated_at;
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

type Props = {
  story: { id: number; slug?: string | null };
  chapters: StoryChapterListRow[];
  chaptersTotal: number;
  shell: string;
  createdAsc: boolean;
  sortPending: boolean;
  onToggleSort: () => void;
  showExpandMore: boolean;
  expandMoreLoading: boolean;
  onExpandMore: () => void;
};

function SortCreatedIcon({ ascending }: { ascending: boolean }) {
  const strong = "text-indigo-600 dark:text-indigo-400";
  const muted = "text-zinc-400 dark:text-zinc-500";
  return (
    <span className="flex flex-col items-center justify-center gap-0.5 leading-none" aria-hidden>
      <svg className={`h-2 w-3 ${ascending ? strong : muted}`} viewBox="0 0 12 6" fill="currentColor">
        <path d="M6 0L12 6H0L6 0z" />
      </svg>
      <svg className={`h-2 w-3 ${ascending ? muted : strong}`} viewBox="0 0 12 6" fill="currentColor">
        <path d="M6 6L0 0h12L6 6z" />
      </svg>
    </span>
  );
}

export function StoryChapterList({
  story,
  chapters,
  chaptersTotal,
  shell,
  createdAsc,
  sortPending,
  onToggleSort,
  showExpandMore,
  expandMoreLoading,
  onExpandMore,
}: Props) {
  return (
    <section className={`${shell} p-5 md:p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Danh sách chương
          </h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {chaptersTotal} chương
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggleSort()}
          disabled={sortPending}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200/90 bg-white/80 text-zinc-600 transition hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-700 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-200"
          title={createdAsc ? "Đang: cũ → mới (theo ngày tạo). Bấm để đảo." : "Đang: mới → cũ. Bấm để đảo."}
          aria-label={
            createdAsc
              ? "Sắp xếp theo ngày tạo tăng dần; bấm để xếp giảm dần"
              : "Sắp xếp theo ngày tạo giảm dần; bấm để xếp tăng dần"
          }
        >
          <SortCreatedIcon ascending={createdAsc} />
        </button>
      </div>
      <ul className="divide-y divide-zinc-200/90 overflow-hidden rounded-xl border border-zinc-200/80 dark:divide-zinc-800 dark:border-zinc-800">
        {chapters.map((chapter) => (
          <li
            key={chapter.id}
            className="flex flex-col gap-3 bg-white/40 px-4 py-3.5 transition hover:bg-white/90 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3 dark:bg-zinc-950/20 dark:hover:bg-zinc-900/50"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{chapter.title}</p>
              <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-500">{chapterListDateTime(chapter)}</p>
            </div>
            <div className="flex shrink-0 sm:pl-2">
              <Link
                href={storyReadHref(story, chapter.id)}
                className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-200"
              >
                Đọc
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {showExpandMore ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => onExpandMore()}
            disabled={expandMoreLoading}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-200"
          >
            {expandMoreLoading ? "Đang tải…" : "Xem thêm"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
