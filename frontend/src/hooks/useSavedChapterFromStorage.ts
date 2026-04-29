"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getSavedChapterRef,
  readProgressStorageKey,
  READING_PROGRESS_EVENT,
  type ReadingProgressDetail,
  type SavedChapterRef,
} from "@/lib/readingProgress";

/** Tiến độ chương đang đọc/nghe (localStorage + sự kiện cùng tab). */
export function useSavedChapterFromStorage(storyKey: string): SavedChapterRef | null {
  const [saved, setSaved] = useState<SavedChapterRef | null>(null);

  const refresh = useCallback(() => {
    setSaved(storyKey.trim() !== "" ? getSavedChapterRef(storyKey) : null);
  }, [storyKey]);

  useEffect(() => {
    refresh();
    const storageKey = readProgressStorageKey(storyKey);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === storageKey) {
        refresh();
      }
    };
    const onProgress = (e: Event) => {
      const ce = e as CustomEvent<ReadingProgressDetail>;
      if (ce.detail?.storyKey === storyKey) {
        setSaved({
          id: ce.detail.chapterId,
          slug: ce.detail.chapterSlug ?? undefined,
        });
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(READING_PROGRESS_EVENT, onProgress as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(READING_PROGRESS_EVENT, onProgress as EventListener);
    };
  }, [storyKey, refresh]);

  return saved;
}
