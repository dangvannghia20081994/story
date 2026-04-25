import Link from "next/link";
import { notFound } from "next/navigation";
import { QueueTtsButton } from "./QueueTtsButton";
import { QueueChapterTtsButton } from "./QueueChapterTtsButton";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SidebarLayout } from "@/components/layouts";
import { apiFetch } from "@/lib/api";

type StoryDetail = {
  data: {
    id: number;
    title: string;
    content: string;
    tts_status: string;
    tts_error: string | null;
    audio_url: string | null;
  };
};

type Chapter = {
  id: number;
  title: string;
  content: string;
  audio_path: string | null;
  status: string;
  duration: number;
};

async function loadStory(id: string): Promise<StoryDetail | null> {
  try {
    return await apiFetch<StoryDetail>(`/api/stories/${id}`);
  } catch {
    return null;
  }
}

async function loadChapters(storyId: string): Promise<Chapter[]> {
  try {
    const res = await apiFetch<{ data: Chapter[] }>(`/api/stories/${storyId}/chapters`);
    return res.data;
  } catch {
    return [];
  }
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadStory(id);
  if (!res) {
    notFound();
  }
  const s = res.data;
  const chapters = await loadChapters(id);

  // Get current chapter for audio
  const currentChapter = chapters.find((c) => c.audio_path && c.status === "completed") || chapters[0];
  const audioSrc = currentChapter?.audio_path || s.audio_url;

  return (
    <SidebarLayout storyId={s.id}>
      <Link href="/" className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400">
        ← Danh sách truyện
      </Link>
      <header className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">{s.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">Trạng thái: {s.tts_status}</p>
          </div>
          {chapters.length > 0 && (
            <Link
              href={`/stories/${id}/read`}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              📖 Đọc truyện
            </Link>
          )}
        </div>
        {s.tts_error ? <p className="text-sm text-red-600">{s.tts_error}</p> : null}
      </header>

      {/* Audio Player with chapters */}
      {audioSrc ? (
        <AudioPlayer
          src={audioSrc}
          title={currentChapter?.title || s.title}
          chapters={chapters.map((c) => ({
            id: c.id,
            title: c.title,
            audio_url: c.audio_path,
          }))}
        />
      ) : (
        <p className="text-sm text-zinc-500">Chưa có file audio. Bấm "Xếp hàng TTS" để worker render.</p>
      )}

      {/* Story-level TTS button */}
      <QueueTtsButton storyId={s.id} />

      {/* Chapters section */}
      {chapters.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Danh sách chương ({chapters.length})</h2>
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {chapters.map((chapter) => (
              <li key={chapter.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{chapter.title}</p>
                  <p className="text-xs text-zinc-500">
                    {chapter.status} • {chapter.duration > 0 ? `${Math.floor(chapter.duration / 60)}p` : "Chưa render"}
                  </p>
                </div>
                <QueueChapterTtsButton storyId={s.id} chapterId={chapter.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Story content */}
      <article>
        <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Nội dung</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{s.content}</p>
      </article>
    </SidebarLayout>
  );
}
