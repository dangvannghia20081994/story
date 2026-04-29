import Link from "next/link";
import { redirect } from "next/navigation";
import { FullWidthLayout } from "@/components/layouts";
import { apiFetch } from "@/lib/api";
import {
  buildStoriesApiQuery,
  buildStoriesListHref,
  parseStoriesListSearchParams,
  type StoriesListFilters,
} from "@/lib/storiesListQuery";
import { StoriesListClient, type StoriesListPaginated } from "../StoriesListClient";
import { CreateStoryButton } from "./CreateStoryButton";
import { StoriesListSidebar } from "./StoriesListSidebar";

async function loadStoriesPage(page: number, filters: StoriesListFilters): Promise<StoriesListPaginated | null> {
  try {
    return await apiFetch<StoriesListPaginated>(buildStoriesApiQuery(page, filters));
  } catch {
    return null;
  }
}

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { page, filters } = parseStoriesListSearchParams(sp);
  const initialList = await loadStoriesPage(page, filters);
  const last = initialList?.last_page ?? 1;
  if (initialList && page > last) {
    redirect(buildStoriesListHref(last >= 1 ? last : 1, filters));
  }

  return (
    <FullWidthLayout>
      <div className="mx-auto flex w-full max-w-[min(88rem,calc(100vw-1.5rem))] flex-col gap-8 p-6 pb-16 md:p-10 xl:max-w-[min(92rem,calc(100vw-2rem))]">
        <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/80 p-6 shadow-lg shadow-violet-900/5 backdrop-blur-md dark:border-zinc-700/60 dark:bg-zinc-900/55 dark:shadow-black/40 md:p-8">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl dark:bg-violet-600/25"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/20"
            aria-hidden
          />

          <header className="relative flex flex-col gap-6 border-b border-zinc-200/80 pb-8 dark:border-zinc-700/60 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
                Story Audio
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white md:text-4xl">
                Danh sách truyện
              </h1>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-base">
                Khám phá thư viện, mở từng truyện để đọc và nghe — giao diện gọn, tập trung vào nội dung.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 md:justify-end">
              <Link
                href="/"
                className="rounded-xl border border-zinc-200/90 bg-white/90 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
              >
                ← Trang chủ
              </Link>
              <CreateStoryButton />
            </div>
          </header>

          <div className="relative flex flex-col gap-8 pt-8 lg:flex-row lg:items-start">
            <StoriesListSidebar filters={filters} />
            <div className="min-w-0 flex-1">
              <StoriesListClient
                key={`${page}-${JSON.stringify(filters)}`}
                currentPage={page}
                filters={filters}
                initialList={initialList}
              />
            </div>
          </div>
        </div>
      </div>
    </FullWidthLayout>
  );
}
