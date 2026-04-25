"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { AudioPlayer } from "@/components/AudioPlayer";

type Chapter = {
  id: number;
  title: string;
  content: string;
  audio_path: string | null;
  status: string;
  duration: number;
};

type Story = {
  id: number;
  title: string;
};

export default function ReadStoryPage({ storyId }: { storyId: string }) {
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [storyRes, chaptersRes] = await Promise.all([
          apiFetch<{ data: Story }>(`/api/stories/${storyId}`),
          apiFetch<{ data: Chapter[] }>(`/api/stories/${storyId}/chapters`),
        ]);
        setStory(storyRes.data);
        setChapters(chaptersRes.data);
      } catch (e) {
        console.error("Failed to load:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [storyId]);

  const currentChapter = chapters[currentChapterIndex];
  const hasPrev = currentChapterIndex > 0;
  const hasNext = currentChapterIndex < chapters.length - 1;

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      setCurrentChapterIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [hasPrev]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      setCurrentChapterIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [hasNext]);

  const goToChapter = useCallback((index: number) => {
    setCurrentChapterIndex(index);
    setShowToc(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-zinc-500">Đang tải...</div>
      </div>
    );
  }

  if (!story || chapters.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-zinc-500">Không tìm thấy truyện hoặc chương</p>
        <Link href={`/stories/${storyId}`} className="text-indigo-600 hover:underline">
          ← Quay lại
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex items-center gap-3">
          <Link href={`/stories/${storyId}`} className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            ← Quay lại
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <button onClick={() => setShowToc(!showToc)} className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            📖 {currentChapter?.title || "Chương"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFontSize((s) => Math.max(14, s - 2))}
            className="rounded p-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            A-
          </button>
          <span className="text-xs text-zinc-500">{fontSize}px</span>
          <button
            onClick={() => setFontSize((s) => Math.min(28, s + 2))}
            className="rounded p-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            A+
          </button>
        </div>
      </header>

      {/* Table of Contents */}
      {showToc && (
        <div className="absolute left-0 right-0 top-14 z-20 max-h-80 overflow-y-auto border-b border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Mục lục</h3>
          <ul className="space-y-1">
            {chapters.map((chapter, index) => (
              <li key={chapter.id}>
                <button
                  onClick={() => goToChapter(index)}
                  className={`w-full truncate rounded px-3 py-2 text-left text-sm ${
                    index === currentChapterIndex
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {index + 1}. {chapter.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 px-4 py-8">
        <article
          className="mx-auto max-w-2xl prose prose-zinc dark:prose-invert"
          style={{ fontSize: `${fontSize}px` }}
        >
          <h2 className="mb-6 text-center text-xl font-semibold text-zinc-800 dark:text-zinc-200">
            {currentChapter?.title}
          </h2>
          <div className="whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">
            {currentChapter?.content}
          </div>
        </article>
      </main>

      {/* Audio Player */}
      {currentChapter?.audio_path && (
        <div className="sticky bottom-0 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto max-w-2xl">
            <AudioPlayer
              src={currentChapter.audio_path}
              title={currentChapter.title}
              chapters={chapters.map((c) => ({
                id: c.id,
                title: c.title,
                audio_url: c.audio_path,
              }))}
              onChapterChange={(id) => {
                const idx = chapters.findIndex((c) => c.id === id);
                if (idx >= 0) setCurrentChapterIndex(idx);
              }}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <footer className="flex items-center justify-between border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={goToPrev}
          disabled={!hasPrev}
          className={`flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium ${
            hasPrev
              ? "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              : "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
          }`}
        >
          ← Chương trước
        </button>
        <span className="text-sm text-zinc-500">
          {currentChapterIndex + 1} / {chapters.length}
        </span>
        <button
          onClick={goToNext}
          disabled={!hasNext}
          className={`flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium ${
            hasNext
              ? "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              : "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
          }`}
        >
          Chương sau →
        </button>
      </footer>
    </div>
  );
}