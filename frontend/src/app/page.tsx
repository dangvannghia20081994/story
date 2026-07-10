import Link from "next/link";
import { HeroBanner } from "@/components/HomeComponents";
import { HomeStoryCard } from "@/components/HomeStoryCard";
import { FullWidthLayout } from "@/components/layouts";
import { apiFetch } from "@/lib/api";
import type { StoryGenreSlug } from "@/lib/genreLabels";
import { buildStoriesListHref, DEFAULT_STORIES_LIST_FILTERS } from "@/lib/storiesListQuery";
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 p-6 md:p-10 xl:max-w-7xl min-[1920px]:max-w-[min(90rem,calc(100vw-5rem)))]">
        <HeroBanner />

        {grouped.map((genre) => (
          <section key={genre.key}>
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-line pb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>{genre.icon}</span>
                <h2 className="font-display text-xl font-bold tracking-tight text-ink md:text-2xl">
                  {genre.label}
                </h2>
              </div>
              <Link
                href={buildStoriesListHref(1, {
                  ...DEFAULT_STORIES_LIST_FILTERS,
                  genres: [genre.key as StoryGenreSlug],
                })}
                className="shrink-0 whitespace-nowrap text-sm font-semibold text-chusa transition hover:text-chusa-deep"
              >
                Xem tất cả →
              </Link>
            </div>

            {genre.stories.length === 0 ? (
              <p className="font-serif text-sm italic text-ink-faint">Chưa có truyện cho thể loại này.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {genre.stories.map((story) => (
                  <div key={story.id} className="flex min-h-0 min-w-0">
                    <HomeStoryCard story={story} />
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        <footer className="mt-2 flex items-center justify-center gap-2 border-t border-line pt-6 text-center text-xs text-ink-faint">
          <span>Tàng thư · Story Audio</span>
          <span aria-hidden>·</span>
          <Link className="transition hover:text-ink" href="/about">
            Giới thiệu
          </Link>
        </footer>
      </div>
    </FullWidthLayout>
  );
}
