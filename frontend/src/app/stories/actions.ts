"use server";

import { apiFetch } from "@/lib/api";
import { buildStoriesApiQuery, type StoriesListFilters } from "@/lib/storiesListQuery";
import type { HomeStoryCardStory } from "@/components/HomeStoryCard";

export type StoriesListPaginated = {
  data: HomeStoryCardStory[];
  current_page: number;
  last_page: number;
  per_page?: number;
  total?: number;
};

export async function fetchStoriesPage(
  page: number,
  filters: StoriesListFilters,
): Promise<StoriesListPaginated> {
  return apiFetch<StoriesListPaginated>(buildStoriesApiQuery(page, filters));
}

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

type StoryShowData = {
  id: number;
  title: string;
  slug: string;
  chapters?: ChapterRow[];
  chapters_total?: number;
};

const CHAPTER_PAGE_SIZE = 25;

export type ChaptersTocPage = {
  data: Array<{
    id: number;
    title: string;
    slug?: string | null;
    content: string;
    audio_single_path?: string | null;
    audio_multiple_path: string | null;
    audio_single_url?: string | null;
    duration: number;
    chapter_number?: number | null;
  }>;
  current_page: number;
  last_page: number;
};

export type ListenSliceResult = {
  id: number;
  title: string;
  slug?: string;
  read_chapter?: Record<string, unknown>;
  read_navigation?: Record<string, unknown>;
  [key: string]: unknown;
};

export async function fetchChaptersToc(storySlug: string, page: number): Promise<ChaptersTocPage> {
  const key = encodeURIComponent(storySlug);
  return apiFetch<ChaptersTocPage>(`/api/stories/${key}/chapters?omit_content=1&per_page=100&page=${page}`);
}

export async function fetchReadSlice(
  storySlug: string,
  chapterSlug: string,
): Promise<Record<string, unknown>> {
  const key = encodeURIComponent(storySlug);
  const cs = encodeURIComponent(chapterSlug);
  const res = await apiFetch<{ data: Record<string, unknown> }>(`/api/stories/${key}?read_chapter_slug=${cs}`);
  return res.data;
}

export async function fetchListenSlice(
  storySlug: string,
  chapterId: number,
  omitContent = false,
): Promise<ListenSliceResult> {
  const key = encodeURIComponent(storySlug);
  const qs = omitContent ? `&read_omit_content=1` : "";
  const res = await apiFetch<{ data: ListenSliceResult }>(`/api/stories/${key}?read_chapter=${chapterId}${qs}`);
  return res.data;
}

export async function fetchStoryChapters(
  storyKey: string,
  order: "asc" | "desc",
  offset: number,
): Promise<{ data: StoryShowData }> {
  return apiFetch<{ data: StoryShowData }>(
    `/api/stories/${encodeURIComponent(storyKey)}?chapters_order=${order}&chapters_full=0&chapters_limit=${CHAPTER_PAGE_SIZE}&chapters_offset=${offset}&chapters_omit_content=1`,
  );
}
