import Link from "next/link";

import { genreLabel } from "@/lib/genreLabels";
import { storyGenreSlugs } from "@/lib/storyGenres";
import { storyDetailHref } from "@/lib/storyPath";

export type HomeStoryCardStory = {
  id: number;
  slug: string | null;
  title: string;
  description: string | null;
  tts_status: string;
  audio_url: string | null;
  genre?: string | null;
  genres?: string[] | null;
  /** Từ API `withCount('chapters')` khi có */
  chapters_count?: number;
  /** Ảnh bìa tùy chọn (nếu API bổ sung sau) */
  cover_url?: string | null;
};

function statusLabel(status: string): string {
  if (status === "completed") return "Đã có audio";
  if (status === "processing") return "Đang xử lý";
  return "Chưa có audio";
}

function statusBadgeClass(): string {
  return "bg-zinc-200 text-zinc-800 ring-1 ring-zinc-300/80 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-500/50";
}

type Props = {
  story: HomeStoryCardStory;
};

export function HomeStoryCard({ story }: Props) {
  const href = storyDetailHref(story);
  const cover = story.cover_url?.trim();
  const genreSlugs = storyGenreSlugs(story);

  return (
    <Link
      href={href}
      title={story.title}
      className="group flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm transition hover:border-violet-400/50 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-800/60 dark:shadow-none dark:hover:border-violet-500/40 dark:hover:bg-zinc-800/90"
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-br from-violet-200 via-indigo-100 to-purple-200 dark:from-violet-950/90 dark:via-indigo-950/80 dark:to-zinc-900">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL từ API (Laravel storage), tránh bắt buộc remotePatterns của next/image
          <img
            src={cover}
            alt={story.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-5xl opacity-90 transition group-hover:scale-105" aria-hidden>
              📚
            </span>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4 pt-3">
        <h3 className="line-clamp-1 min-h-[1.275rem] text-[0.9375rem] font-bold leading-snug text-zinc-900 transition group-hover:text-violet-700 dark:text-zinc-50 dark:group-hover:text-violet-300">
          {story.title}
        </h3>

        <div className="flex min-h-[1.625rem] flex-wrap content-start gap-1.5">
          {genreSlugs.map((slug) => {
            const label = genreLabel(slug);
            if (!label) return null;
            return (
              <span
                key={slug}
                className="rounded-md bg-violet-500/12 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-800 dark:bg-violet-400/15 dark:text-violet-200"
              >
                {label}
              </span>
            );
          })}
        </div>

        <p className="min-h-[1.25rem] text-[11px] text-zinc-500 dark:text-zinc-500">
          {typeof story.chapters_count === "number" && story.chapters_count > 0 ? `${story.chapters_count} chương` : "\u00a0"}
        </p>

        <div className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-700/80">
          <span
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium ${statusBadgeClass()}`}
          >
            {statusLabel(story.tts_status)}
          </span>
          {story.audio_url ? (
            <span className="truncate text-xs font-semibold text-emerald-600 dark:text-emerald-400">Có audio</span>
          ) : (
            <span className="truncate text-xs text-zinc-400 dark:text-zinc-500">Chưa audio</span>
          )}
        </div>
      </div>
    </Link>
  );
}
