"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useSavedChapterFromStorage } from "@/hooks/useSavedChapterFromStorage";
import { chapterForStoryHref, type ChapterLinkRef, storyListenAudioHref } from "@/lib/storyPath";

type Props = {
  storyKey: string;
  firstChapter: ChapterLinkRef;
  chapters: ChapterLinkRef[];
};

export function StoryListenAudioPrimaryButton({ storyKey, firstChapter, chapters }: Props) {
  const saved = useSavedChapterFromStorage(storyKey);
  const hasProgress = saved != null;

  const href = useMemo(
    () =>
      storyListenAudioHref(
        storyKey,
        chapterForStoryHref(hasProgress ? saved.id : null, firstChapter, chapters, saved?.slug),
      ),
    [storyKey, hasProgress, saved, firstChapter, chapters],
  );

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
