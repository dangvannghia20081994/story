"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { isSpeechSynthesisSupported } from "@/lib/browserSpeech";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { storyListenAudioHref, storyListenHref, storyReadHref } from "@/lib/storyPath";

export type StoryChapterListRow = {
  id: number;
  title: string;
  slug?: string | null;
  audio_multiple_path?: string | null;
  audio_single_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Định dạng cố định theo UTC — tránh lệch SSR/CSR với Intl.DateTimeFormat + vi-VN giữa Node và trình duyệt. */
function chapterListDateTime(c: StoryChapterListRow): string {
  const raw = c.created_at ?? c.updated_at;
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

type Props = {
  storyKey: string;
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
  const strong = "text-chusa";
  const muted = "text-ink-faint";
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

const ttsDisabledClass =
  "inline-flex cursor-not-allowed items-center rounded-lg border border-line bg-paper-inset px-3 py-1.5 text-xs font-semibold text-ink-faint opacity-70";

export function StoryChapterList({
  storyKey,
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
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setTtsSupported(isSpeechSynthesisSupported());
  }, []);

  const ttsUsable = ttsSupported !== false;

  return (
    <section className={`${shell} p-5 md:p-6`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Danh sách chương
          </h2>
          <span className="rounded-full bg-paper-inset px-2.5 py-0.5 text-xs font-medium text-ink-soft">
            {chaptersTotal} chương
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggleSort()}
          disabled={sortPending}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-raised text-ink-soft transition hover:border-chusa/40 hover:bg-chusa/10 hover:text-chusa disabled:cursor-wait disabled:opacity-60"
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
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {chapters.map((chapter) => {
          const audioHrefUrl = resolvePlayableAudioUrl(chapter.audio_single_url, chapter.audio_multiple_path);
          return (
            <li
              key={chapter.id}
              className="flex flex-col gap-3 bg-paper-raised/40 px-4 py-3.5 transition hover:bg-paper-raised sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium text-ink">{chapter.title}</p>
                <p className="text-xs tabular-nums text-ink-faint">{chapterListDateTime(chapter)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end sm:pl-2">
                <Link
                  href={storyReadHref(storyKey, chapter)}
                  className="inline-flex items-center rounded-lg bg-chusa px-3 py-1.5 text-xs font-semibold text-[#f6ede0] transition hover:bg-chusa-deep"
                >
                  Đọc
                </Link>
                {ttsUsable ? (
                  <Link
                    href={storyListenHref(storyKey, chapter)}
                    className="inline-flex items-center rounded-lg border border-ngoc/25 bg-ngoc/10 px-3 py-1.5 text-xs font-semibold text-ngoc transition hover:border-ngoc/50 hover:bg-ngoc/15"
                  >
                    TTS
                  </Link>
                ) : (
                  <span
                    role="button"
                    aria-disabled
                    title="Trình duyệt không hỗ trợ đọc TTS (Web Speech API)"
                    className={ttsDisabledClass}
                  >
                    TTS
                  </span>
                )}
                {audioHrefUrl ? (
                  <Link
                    href={storyListenAudioHref(storyKey, chapter)}
                    className="inline-flex items-center rounded-lg border border-ngoc/25 bg-ngoc/10 px-3 py-1.5 text-xs font-semibold text-ngoc transition hover:border-ngoc/50 hover:bg-ngoc/15"
                  >
                    Audio
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Chương này chưa có file audio"
                    className="inline-flex cursor-not-allowed items-center rounded-lg border border-line bg-paper-inset px-3 py-1.5 text-xs font-semibold text-ink-faint opacity-70"
                  >
                    Audio
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {showExpandMore ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => onExpandMore()}
            disabled={expandMoreLoading}
            className="rounded-lg border border-line bg-paper-raised px-4 py-2 text-sm font-medium text-ink transition hover:border-chusa/40 hover:text-chusa disabled:cursor-wait disabled:opacity-60"
          >
            {expandMoreLoading ? "Đang tải…" : "Xem thêm"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
