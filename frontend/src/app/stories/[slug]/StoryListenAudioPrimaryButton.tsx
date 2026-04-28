"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getSavedChapterId, READING_PROGRESS_EVENT, type ReadingProgressDetail } from "@/lib/readingProgress";
import { storyListenAudioHref } from "@/lib/storyPath";

type Props = {
  storyKey: string;
  story: { id: number; slug: string | null };
};

export function StoryListenAudioPrimaryButton({ storyKey, story }: Props) {
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
  const href = storyListenAudioHref(story, hasProgress ? savedChapterId : undefined);

  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 sm:w-auto dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/55"
    >
      <span aria-hidden>🎵</span>
      {hasProgress ? "Nghe audio tiếp" : "Nghe audio"}
    </Link>
  );
}
