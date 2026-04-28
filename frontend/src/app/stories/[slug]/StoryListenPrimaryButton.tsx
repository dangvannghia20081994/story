"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { isSpeechSynthesisSupported } from "@/lib/browserSpeech";
import { getSavedChapterId, READING_PROGRESS_EVENT, type ReadingProgressDetail } from "@/lib/readingProgress";
import { storyListenHref } from "@/lib/storyPath";

type Props = {
  storyKey: string;
  story: { id: number; slug: string | null };
};

export function StoryListenPrimaryButton({ storyKey, story }: Props) {
  const [savedChapterId, setSavedChapterId] = useState<number | null>(null);
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    setSavedChapterId(getSavedChapterId(storyKey));
  }, [storyKey]);

  useEffect(() => {
    setTtsSupported(isSpeechSynthesisSupported());
  }, []);

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
  const href = storyListenHref(story, hasProgress ? savedChapterId : undefined);
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
