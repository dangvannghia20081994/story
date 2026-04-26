import Link from "next/link";
import { FullWidthLayout } from "@/components/layouts";
import { apiFetch } from "@/lib/api";
import { storyDetailHref } from "@/lib/storyPath";

type Story = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  genre: string | null;
  tts_status: string;
  audio_url: string | null;
  created_at: string | null;
};

type StoryResponse = {
  data: Story[];
};

function scoreStory(story: Story): number {
  const statusScore = story.tts_status === "completed" ? 60 : story.tts_status === "processing" ? 35 : 15;
  const audioBonus = story.audio_url ? 25 : 0;
  const descriptionBonus = story.description ? Math.min(15, Math.floor(story.description.length / 40)) : 0;
  return statusScore + audioBonus + descriptionBonus;
}

function statusLabel(status: string): string {
  if (status === "completed") return "Đã render";
  if (status === "processing") return "Đang xử lý";
  return "Chưa render";
}

async function loadRankings(): Promise<Array<Story & { score: number }>> {
  try {
    const res = await apiFetch<StoryResponse>("/api/stories?per_page=60");
    return (res.data ?? [])
      .map((story) => ({ ...story, score: scoreStory(story) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export default async function RankingsPage() {
  const rankings = await loadRankings();

  return (
    <FullWidthLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
        <header className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/70">
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Bảng xếp hạng truyện</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Xếp hạng dựa trên tiến độ TTS, tình trạng audio và độ đầy đủ nội dung.
          </p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75">
          {rankings.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Chưa có dữ liệu để xếp hạng.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Hạng</th>
                    <th className="px-4 py-3">Truyện</th>
                    <th className="px-4 py-3">Thể loại</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((story, index) => (
                    <tr key={story.id} className="border-b border-zinc-100 dark:border-zinc-800/70">
                      <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">#{index + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={storyDetailHref(story)}
                          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {story.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{story.genre ?? "khac"}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{statusLabel(story.tts_status)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-800 dark:text-zinc-100">{story.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </FullWidthLayout>
  );
}
