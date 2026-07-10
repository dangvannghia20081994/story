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
        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-line bg-paper-inset px-4 py-2 text-sm font-semibold text-ink-faint opacity-80 sm:w-auto"
      >
        <span aria-hidden>🎧</span>
        {hasProgress ? "Nghe tiếp" : "Nghe truyện"}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ngoc/25 bg-ngoc/10 px-4 py-2 text-sm font-semibold text-ngoc transition hover:border-ngoc/50 hover:bg-ngoc/15 sm:w-auto"
    >
      <span aria-hidden>🎧</span>
      {hasProgress ? "Nghe tiếp" : "Nghe truyện"}
    </Link>
  );
}
