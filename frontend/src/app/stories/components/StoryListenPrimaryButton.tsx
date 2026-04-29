"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSavedChapterFromStorage } from "@/hooks/useSavedChapterFromStorage";
import { isSpeechSynthesisSupported } from "@/lib/browserSpeech";
import { chapterForStoryHref, type ChapterLinkRef, storyListenHref } from "@/lib/storyPath";

type Props = {
  storyKey: string;
  firstChapter: ChapterLinkRef;
  chapters: ChapterLinkRef[];
};

export function StoryListenPrimaryButton({ storyKey, firstChapter, chapters }: Props) {
  const saved = useSavedChapterFromStorage(storyKey);
  const hasProgress = saved != null;
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setTtsSupported(isSpeechSynthesisSupported());
  }, []);

  const href = useMemo(
    () =>
      storyListenHref(
        storyKey,
        chapterForStoryHref(hasProgress ? saved.id : null, firstChapter, chapters, saved?.slug),
      ),
    [storyKey, hasProgress, saved, firstChapter, chapters],
  );

  const ttsUsable = ttsSupported !== false;

  if (!ttsUsable) {
    return (
      <span
        role="button"
        aria-disabled
        title="Trình duyệt không hỗ trợ đọc TTS (Web Speech API)"
        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-400 opacity-80 sm:w-auto dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-500"
      >
        <span aria-hidden>🎧</span>
        {hasProgress ? "Nghe tiếp" : "Nghe truyện"}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 sm:w-auto dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/60"
    >
      <span aria-hidden>🎧</span>
      {hasProgress ? "Nghe tiếp" : "Nghe truyện"}
    </Link>
  );
}
