import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { resolvePlayableAudioUrl } from "@/lib/mediaUrl";
import { storyDetailHref } from "@/lib/storyPath";

type StoryRow = {
  id: number;
  slug: string | null;
  title: string;
  tts_status: string;
  audio_url: string | null;
};

type Paginated = {
  data: StoryRow[];
};

async function loadStories(): Promise<Paginated> {
  return apiFetch<Paginated>("/api/stories");
}

export async function StoriesList() {
  let payload: Paginated;
  try {
    payload = await loadStories();
  } catch (e) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        Không tải được danh sách: {(e as Error).message}
      </section>
    );
  }

  if (payload.data.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Chưa có truyện. Dùng nút Thêm truyện phía trên để tạo mới.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {payload.data.map((s) => {
        const sampleSrc = resolvePlayableAudioUrl(s.audio_url, null);
        return (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <Link
              href={storyDetailHref(s)}
              className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
            >
              {s.title}
            </Link>
            <p className="text-xs text-zinc-500">Audio: {s.tts_status === "completed" ? "đã có" : s.tts_status === "processing" ? "đang xử lý" : "chưa có"}</p>
          </div>
          {sampleSrc ? (
            <audio controls preload="none" className="h-8 max-w-full">
              <source src={sampleSrc} type="audio/mpeg" />
            </audio>
          ) : (
            <span className="text-xs text-zinc-400">Chưa có audio</span>
          )}
        </li>
        );
      })}
    </ul>
  );
}
