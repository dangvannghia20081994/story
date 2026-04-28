import { HomeStoryCard, type HomeStoryCardStory } from "@/components/HomeStoryCard";
import { apiFetch } from "@/lib/api";

type StoryRow = HomeStoryCardStory;

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
      <section className="rounded-xl border border-red-200/90 bg-red-50/95 p-5 text-sm text-red-800 dark:border-red-900/80 dark:bg-red-950/60 dark:text-red-200">
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
    <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {payload.data.map((s) => (
        <li key={s.id} className="min-w-0">
          <HomeStoryCard story={s} />
        </li>
      ))}
    </ul>
  );
}
