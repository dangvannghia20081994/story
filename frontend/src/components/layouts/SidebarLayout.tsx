"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Story = {
  id: number;
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

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">{children}</div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Related Stories */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Truyện khác
            </h3>
            {relatedStories.length > 0 ? (
              <ul className="space-y-2">
                {relatedStories.map((story) => (
                  <li key={story.id}>
                    <Link
                      href={`/stories/${story.id}`}
                      className="block truncate rounded py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-indigo-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-indigo-400"
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
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Liên kết nhanh
            </h3>
            <nav className="space-y-1">
              <Link
                href="/"
                className="block rounded py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                🏠 Trang chủ
              </Link>
              <Link
                href="/stories"
                className="block rounded py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                📚 Danh sách truyện
              </Link>
              <Link
                href="/about"
                className="block rounded py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
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