"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchStoryChapters } from "@/app/stories/actions";
import { StoryChapterList } from "./StoryChapterList";

type ChapterRow = {
  id: number;
  title: string;
  slug?: string | null;
  content: string;
  audio_multiple_path: string | null;
  audio_single_url?: string | null;
  duration: number;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  storyKey: string;
  initialChapters: ChapterRow[];
  initialChaptersTotal: number;
  shell: string;
};

export function StoryChaptersBlock({
  storyKey,
  initialChapters,
  initialChaptersTotal,
  shell,
}: Props) {
  const [chapters, setChapters] = useState<ChapterRow[]>(initialChapters);
  const [chaptersTotal, setChaptersTotal] = useState(initialChaptersTotal);
  const [createdAsc, setCreatedAsc] = useState(true);
  const [sortPending, setSortPending] = useState(false);
  const [expandMoreLoading, setExpandMoreLoading] = useState(false);

  const initialSnapshot = useMemo(
    () => JSON.stringify({ total: initialChaptersTotal, ids: initialChapters.map((c) => c.id) }),
    [initialChapters, initialChaptersTotal],
  );
  const [lastServerSnapshot, setLastServerSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    if (initialSnapshot === lastServerSnapshot) return;
    setLastServerSnapshot(initialSnapshot);
    setChapters(initialChapters);
    setChaptersTotal(initialChaptersTotal);
  }, [initialChapters, initialChaptersTotal, initialSnapshot, lastServerSnapshot]);

  const toggleSort = useCallback(async () => {
    const nextAsc = !createdAsc;
    const order = nextAsc ? "asc" : "desc";
    setSortPending(true);
    try {
      const res = await fetchStoryChapters(storyKey, order, 0);
      const raw = res.data.chapters;
      setChapters(Array.isArray(raw) ? raw : []);
      setCreatedAsc(nextAsc);
      if (typeof res.data.chapters_total === "number") {
        setChaptersTotal(res.data.chapters_total);
      }
    } finally {
      setSortPending(false);
    }
  }, [createdAsc, storyKey]);

  const expandMore = useCallback(async () => {
    const order = createdAsc ? "asc" : "desc";
    const have = chapters.length;
    if (have >= chaptersTotal) {
      return;
    }
    setExpandMoreLoading(true);
    try {
      const res = await fetchStoryChapters(storyKey, order, have);
      const batch = res.data.chapters ?? [];
      if (batch.length === 0) {
        setChaptersTotal(have);
        return;
      }
      setChapters((prev) => {
        const byId = new Map<number, ChapterRow>();
        for (const c of prev) {
          byId.set(c.id, c);
        }
        for (const c of batch) {
          byId.set(c.id, c);
        }
        return Array.from(byId.values());
      });
      if (typeof res.data.chapters_total === "number") {
        setChaptersTotal(res.data.chapters_total);
      }
    } finally {
      setExpandMoreLoading(false);
    }
  }, [createdAsc, storyKey, chapters.length, chaptersTotal]);

  const showExpandMore = chaptersTotal > 6 && chapters.length < chaptersTotal;

  return (
    <>
      <StoryChapterList
        storyKey={storyKey}
        chapters={chapters}
        chaptersTotal={chaptersTotal}
        shell={shell}
        createdAsc={createdAsc}
        sortPending={sortPending}
        onToggleSort={toggleSort}
        showExpandMore={showExpandMore}
        expandMoreLoading={expandMoreLoading}
        onExpandMore={expandMore}
      />
    </>
  );
}
