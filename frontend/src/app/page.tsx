import Link from "next/link";
import { HeroBanner } from "@/components/HomeComponents";
import { HomeStoryCard } from "@/components/HomeStoryCard";
import { FullWidthLayout } from "@/components/layouts";
import { apiFetch } from "@/lib/api";
import { storyBelongsToGenreSlug } from "@/lib/storyGenres";

type Story = {
  id: number;
  slug: string | null;
  title: string;
  description: string | null;
  genre?: string | null;
  genres?: string[] | null;
  tts_status: string;
  audio_url: string | null;
  chapters_count?: number;
  cover_url?: string | null;
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
    stories: stories.filter((story) => storyBelongsToGenreSlug(story, genre.key)).slice(0, 4),
  }));

  return (
    <FullWidthLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 md:p-10 xl:max-w-7xl min-[1920px]:max-w-[min(90rem,calc(100vw-5rem)))]">
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
                Xem tất cả →
              </Link>
            </div>

            {genre.stories.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Chưa có truyện cho thể loại này.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {genre.stories.map((story) => (
                  <HomeStoryCard key={story.id} story={story} />
                ))}
              </div>
            )}
          </section>
        ))}

        <footer className="mt-2 border-t border-zinc-200/70 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-700/70">
          <p>
            Powered by{" "}
            <Link className="underline" href="http://localhost:8000">
              Laravel API
            </Link>
          </p>
        </footer>
      </div>
    </FullWidthLayout>
  );
}
