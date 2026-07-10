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
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ngoc/25 bg-ngoc/10 px-4 py-2 text-sm font-semibold text-ngoc transition hover:border-ngoc/50 hover:bg-ngoc/15 sm:w-auto"
    >
      <span aria-hidden>🎵</span>
      {hasProgress ? "Nghe audio tiếp" : "Nghe audio"}
    </Link>
  );
}
