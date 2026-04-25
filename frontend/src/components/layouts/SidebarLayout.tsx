"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { storyDetailHref } from "@/lib/storyPath";

type Story = {
  id: number;
  slug: string | null;
  title: string;
  tts_status: string;
};

interface SidebarLayoutProps {
  children: ReactNode;
  storyId?: number;
}

export function SidebarLayout({ children, storyId }: SidebarLayoutProps) {
  const [relatedStories, setRelatedStories] = useState<Story[]>([]);

  useEffect(() => {
    async function loadRelated() {
      try {
        const res = await apiFetch<{ data: Story[] }>("/api/stories?limit=5");
        setRelatedStories(res.data.filter((s) => s.id !== storyId));
      } catch (e) {
        console.error("Failed to load related stories:", e);
      }
    }
    if (storyId) {
      loadRelated();
    }
  }, [storyId]);

  const panel =
    "rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75";

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="min-w-0 lg:col-span-2">{children}</div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:pt-0">
          {/* Related Stories */}
          <div className={panel}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Truyện khác
            </h3>
            {relatedStories.length > 0 ? (
              <ul className="space-y-2">
                {relatedStories.map((story) => (
                  <li key={story.id}>
                    <Link
                      href={storyDetailHref(story)}
                      className="block truncate rounded-lg px-2 py-2 text-sm text-zinc-700 transition hover:bg-indigo-50 hover:text-indigo-700 dark:text-zinc-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                    >
                      {story.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500">Không có truyện khác</p>
            )}
          </div>

          {/* Quick Links */}
          <div className={panel}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Liên kết nhanh
            </h3>
            <nav className="space-y-0.5">
              <Link
                href="/"
                className="block rounded-lg px-2 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              >
                🏠 Trang chủ
              </Link>
              <Link
                href="/stories"
                className="block rounded-lg px-2 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              >
                📚 Danh sách truyện
              </Link>
              <Link
                href="/rankings"
                className="block rounded-lg px-2 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              >
                🏆 Bảng xếp hạng
              </Link>
              <Link
                href="/members"
                className="block rounded-lg px-2 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              >
                👥 Thành viên
              </Link>
              <Link
                href="/about"
                className="block rounded-lg px-2 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              >
                ℹ️ Giới thiệu
              </Link>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}