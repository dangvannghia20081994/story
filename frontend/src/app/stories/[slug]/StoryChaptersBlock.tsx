"use client";

import { useCallback, useState } from "react";

import { apiFetch } from "@/lib/api";
import { StoryChapterList } from "./StoryChapterList";

type ChapterRow = {
  id: number;
  title: string;
  content: string;
  audio_path: string | null;
  audio_url?: string | null;
  duration: number;
  created_at?: string;
  updated_at?: string;
};

type StoryShowData = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  genre?: string | null;
  genres?: string[] | null;
  serial_status?: string | null;
  chapters?: ChapterRow[];
  chapters_count?: number;
  chapters_total?: number;
  chapters_with_audio_total?: number;
  characters_count?: number;
};

function storyShowQuery(storyKey: string, order: "asc" | "desc", chaptersFull: boolean): string {
  const full = chaptersFull ? "1" : "0";
  return `/api/stories/${encodeURIComponent(storyKey)}?chapters_order=${order}&chapters_full=${full}`;
}

type Props = {
  storyKey: string;
  story: { id: number; slug?: string | null };
  initialChapters: ChapterRow[];
  initialChaptersTotal: number;
  shell: string;
};

export function StoryChaptersBlock({
  storyKey,
  story,
  initialChapters,
  initialChaptersTotal,
  shell,
}: Props) {
  const [chapters, setChapters] = useState<ChapterRow[]>(initialChapters);
  const [chaptersTotal, setChaptersTotal] = useState(initialChaptersTotal);
  const [createdAsc, setCreatedAsc] = useState(true);
  const [sortPending, setSortPending] = useState(false);
  const [expandMoreLoading, setExpandMoreLoading] = useState(false);

  const requestFullChapters = chapters.length >= chaptersTotal && chaptersTotal > 0;

  const toggleSort = useCallback(async () => {
    const nextAsc = !createdAsc;
    const order = nextAsc ? "asc" : "desc";
    const full = requestFullChapters;
    setSortPending(true);
    try {
      const res = await apiFetch<{ data: StoryShowData }>(storyShowQuery(storyKey, order, full));
      const raw = res.data.chapters;
      setChapters(Array.isArray(raw) ? raw : []);
      setCreatedAsc(nextAsc);
      if (typeof res.data.chapters_total === "number") {
        setChaptersTotal(res.data.chapters_total);
      }
    } finally {
      setSortPending(false);
    }
  }, [createdAsc, storyKey, requestFullChapters]);

  const expandMore = useCallback(async () => {
    const order = createdAsc ? "asc" : "desc";
    setExpandMoreLoading(true);
    try {
      const res = await apiFetch<{ data: StoryShowData }>(storyShowQuery(storyKey, order, true));
      const raw = res.data.chapters;
      setChapters(Array.isArray(raw) ? raw : []);
      if (typeof res.data.chapters_total === "number") {
        setChaptersTotal(res.data.chapters_total);
      }
    } finally {
      setExpandMoreLoading(false);
    }
  }, [createdAsc, storyKey]);

  const showExpandMore = chaptersTotal > 6 && chapters.length < chaptersTotal;

  return (
    <>
      <StoryChapterList
        story={story}
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
