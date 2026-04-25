import Link from "next/link";
import { HeroBanner } from "@/components/HomeComponents";
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
};

type PaginatedStories = {
  data: Story[];
};

const genreDefinitions = [
  { key: "tu-tien", label: "Tu Tiên", icon: "⚔️" },
  { key: "huyen-huyen", label: "Huyền Huyễn", icon: "🔮" },
  { key: "kiem-hiep", label: "Kiếm Hiệp", icon: "🗡️" },
  { key: "do-thi", label: "Đô Thị", icon: "🏙️" },
  { key: "khac", label: "Khác", icon: "📚" },
];

function statusLabel(status: string): string {
  if (status === "completed") return "Da render";
  if (status === "processing") return "Dang xu ly";
  return "Chua render";
}

async function loadStories(): Promise<Story[]> {
  try {
    const res = await apiFetch<PaginatedStories>("/api/stories?per_page=80");
    return res.data ?? [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const stories = await loadStories();
  const grouped = genreDefinitions.map((genre) => ({
    ...genre,
    stories: stories.filter((story) => (story.genre ?? "khac") === genre.key).slice(0, 4),
  }));

  return (
    <FullWidthLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 md:p-10">
        <HeroBanner />

        {grouped.map((genre) => (
          <section
            key={genre.key}
            className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75 md:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                <span className="mr-2">{genre.icon}</span>
                {genre.label}
              </h2>
              <Link href="/stories" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                Xem tat ca →
              </Link>
            </div>

            {genre.stories.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Chua co truyen cho the loai nay.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {genre.stories.map((story) => (
                  <Link
                    key={story.id}
                    href={storyDetailHref(story)}
                    className="group rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-600"
                  >
                    <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50">
                      <span className="text-4xl">📚</span>
                    </div>
                    <h3 className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold text-zinc-800 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
                      {story.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {story.description || "Khong co mo ta"}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {statusLabel(story.tts_status)}
                      </span>
                      {story.audio_url ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">Co audio</span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">Chua audio</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}

        <footer className="mt-2 border-t border-zinc-200/70 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-700/70">
          <p>
            Powered by{" "}
            <Link className="underline" href="http://localhost:8000">
              Laravel + Python Worker
            </Link>
          </p>
        </footer>
      </div>
    </FullWidthLayout>
  );
}
