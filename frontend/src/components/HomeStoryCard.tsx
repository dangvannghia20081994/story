import Link from "next/link";

import { Seal } from "@/components/Seal";
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
  if (status === "processing") return "Đang tổng hợp";
  return "Chưa có audio";
}

type Props = {
  story: HomeStoryCardStory;
};

export function HomeStoryCard({ story }: Props) {
  const href = storyDetailHref(story);
  const cover = story.cover_url?.trim();
  const genreSlugs = storyGenreSlugs(story);
  const hasAudio = Boolean(story.audio_url) || story.tts_status === "completed";

  return (
    <Link
      href={href}
      title={story.title}
      className="paper-card group flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-chusa/40 hover:shadow-[0_14px_30px_-18px_rgba(33,30,26,0.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chusa"
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-paper-inset">
        {/* gáy sách mảnh bên trái */}
        <span className="absolute inset-y-0 left-0 z-10 w-[3px] bg-gradient-to-b from-chusa/70 via-chusa/40 to-transparent" aria-hidden />
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL từ API (Laravel storage), tránh bắt buộc remotePatterns của next/image
          <img
            src={cover}
            alt={story.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-4xl font-black text-ink-faint/40 transition group-hover:text-chusa/50" aria-hidden>
              {story.title.trim().charAt(0) || "書"}
            </span>
          </div>
        )}
        {hasAudio ? (
          <span className="absolute right-2.5 top-2.5 z-10">
            <Seal size={26} title="Có audio" />
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4 pt-3">
        <h3 className="line-clamp-1 min-h-[1.4rem] font-display text-[0.975rem] font-bold leading-snug text-ink transition group-hover:text-chusa">
          {story.title}
        </h3>

        <div className="flex min-h-[1.5rem] flex-wrap content-start gap-1.5">
          {genreSlugs.map((slug) => {
            const label = genreLabel(slug);
            if (!label) return null;
            return (
              <span
                key={slug}
                className="rounded bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft"
              >
                {label}
              </span>
            );
          })}
        </div>

        <p className="min-h-[1.1rem] font-serif text-xs text-ink-faint">
          {typeof story.chapters_count === "number" && story.chapters_count > 0 ? `${story.chapters_count} chương` : "\u00a0"}
        </p>

        <div className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t border-line pt-3">
          <span className="truncate text-[11px] font-medium text-ink-faint">{statusLabel(story.tts_status)}</span>
          {hasAudio ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-ngoc">
              <span className="h-1.5 w-1.5 rounded-full bg-ngoc" aria-hidden />
              Nghe được
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
