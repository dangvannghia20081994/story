"use client";

import { useCallback, useState } from "react";

import { AudioPlayer } from "@/components/AudioPlayer";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";

type ChapterRow = {
  id: number;
  title: string;
  content: string;
  audio_path: string | null;
  audio_url?: string | null;
  duration: number;
};

function chapterAudioUrl(c: ChapterRow): string | null {
  return resolvePlayableAudioUrl(c.audio_url, c.audio_path);
}

type Props = {
  storyTitle: string;
  chapters: ChapterRow[];
};

export function StoryDetailAudio({ storyTitle, chapters }: Props) {
  const [chapterId, setChapterId] = useState<number | null>(() => {
    const first = chapters.find((c) => chapterAudioUrl(c)) ?? chapters[0];
    return first?.id ?? null;
  });

  const current = chapters.find((c) => c.id === chapterId) ?? chapters[0];
  const onChapterChange = useCallback((id: number) => {
    setChapterId(id);
  }, []);

  if (!current) return null;

  const audioSrc = chapterAudioUrl(current);

  return (
    <AudioPlayer
      layout="detail"
      storyTitle={storyTitle}
      src={audioSrc ?? ""}
      speechText={current.content}
      title={current.title}
      chapters={chapters.map((c) => ({
        id: c.id,
        title: c.title,
        audio_url: chapterAudioUrl(c),
        speech_text: c.content,
      }))}
      initialChapterId={current.id}
      onChapterChange={onChapterChange}
    />
  );
}
