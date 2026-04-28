"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getSavedChapterId, READING_PROGRESS_EVENT, type ReadingProgressDetail } from "@/lib/readingProgress";
import { storyReadHref } from "@/lib/storyPath";

type Props = {
  storyKey: string;
  story: { id: number; slug: string | null };
};

export function StoryReadPrimaryButton({ storyKey, story }: Props) {
  const [savedChapterId, setSavedChapterId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    setSavedChapterId(getSavedChapterId(storyKey));
  }, [storyKey]);

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === `story-read:${storyKey}`) {
        refresh();
      }
    };
    const onProgress = (e: Event) => {
      const ce = e as CustomEvent<ReadingProgressDetail>;
      if (ce.detail?.storyKey === storyKey) {
        setSavedChapterId(ce.detail.chapterId);
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(READING_PROGRESS_EVENT, onProgress as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(READING_PROGRESS_EVENT, onProgress as EventListener);
    };
  }, [storyKey, refresh]);

  const hasProgress = savedChapterId != null;
  const href = storyReadHref(story, hasProgress ? savedChapterId : undefined);

  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:bg-indigo-500 sm:w-auto"
    >
      <span aria-hidden>{hasProgress ? "▶" : "📖"}</span>
      {hasProgress ? "Đọc tiếp" : "Đọc truyện"}
    </Link>
  );
}
