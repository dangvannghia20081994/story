"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useSavedChapterFromStorage } from "@/hooks/useSavedChapterFromStorage";
import { chapterForStoryHref, type ChapterLinkRef, storyReadHref } from "@/lib/storyPath";

type Props = {
  storyKey: string;
  firstChapter: ChapterLinkRef;
  chapters: ChapterLinkRef[];
};

export function StoryReadPrimaryButton({ storyKey, firstChapter, chapters }: Props) {
  const saved = useSavedChapterFromStorage(storyKey);
  const hasProgress = saved != null;

  const href = useMemo(
    () =>
      storyReadHref(
        storyKey,
        chapterForStoryHref(hasProgress ? saved.id : null, firstChapter, chapters, saved?.slug),
      ),
    [storyKey, hasProgress, saved, firstChapter, chapters],
  );

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
