"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { storyDetailHref } from "@/lib/storyPath";

type Story = {
  id: number;
  slug: string | null;
  title: string;
  description: string | null;
  tts_status: string;
  audio_url: string | null;
  created_at: string;
};

type FeaturedStory = {
  id: number;
  title: string;
  description: string | null;
  cover_image: string | null;
};

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-6 py-12 text-white dark:from-indigo-900 dark:via-purple-900 dark:to-pink-900 md:px-12 md:py-20">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full bg-white blur-3xl" />
      </div>
      
      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
          Nghe Truyện Tiên Hiệp
        </h1>
        <p className="mb-8 text-lg text-white/80">
          Trải nghiệm đọc truyện với giọng đọc AI chất lượng cao. 
          Phân vai nhân vật, từ điển tu tiên tối ưu.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/stories"
            className="rounded-full bg-white px-6 py-3 font-semibold text-indigo-600 transition hover:bg-white/90"
          >
            Khám phá ngay
          </Link>
          <Link
            href="/about"
            className="rounded-full border border-white/30 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Tìm hiểu thêm
          </Link>
        </div>
      </div>
    </section>
  );
}

export function FeaturedStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ data: Story[] }>("/api/stories?limit=6");
        setStories(res.data);
      } catch (e) {
        console.error("Failed to load stories:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800">
            <div className="h-32 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-3 h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-2 h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-zinc-500">Chưa có truyện nào. Hãy thêm truyện đầu tiên!</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stories.map((story) => (
        <Link
          key={story.id}
          href={storyDetailHref(story)}
          className="group block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-600"
        >
          <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50">
            <span className="text-4xl">📖</span>
          </div>
          <h3 className="mb-1 truncate font-semibold text-zinc-800 group-hover:text-indigo-600 dark:text-zinc-200 dark:group-hover:text-indigo-400">
            {story.title}
          </h3>
          <p className="mb-2 line-clamp-2 text-xs text-zinc-500">
            {story.description || "Không có mô tả"}
          </p>
          <div className="flex items-center justify-between">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                story.tts_status === "completed"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : story.tts_status === "processing"
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {story.tts_status === "completed" ? "✓ Đã render" : story.tts_status === "processing" ? "⏳ Đang xử lý" : "Chưa render"}
            </span>
            {story.audio_url && (
              <span className="text-xs text-indigo-600 dark:text-indigo-400">▶ Nghe</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function Categories() {
  const categories = [
    { name: "Tu Tiên", icon: "⚔️", count: 12 },
    { name: "Huyền Huyễn", icon: "🔮", count: 8 },
    { name: "Kiếm Hiệp", icon: "🗡️", count: 15 },
    { name: "Ngôn Tình", icon: "💕", count: 6 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {categories.map((cat) => (
        <Link
          key={cat.name}
          href={`/stories?category=${cat.name}`}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 transition hover:border-indigo-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <span className="text-2xl">{cat.icon}</span>
          <div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{cat.name}</p>
            <p className="text-xs text-zinc-500">{cat.count} truyện</p>
          </div>
        </Link>
      ))}
    </div>
  );
}