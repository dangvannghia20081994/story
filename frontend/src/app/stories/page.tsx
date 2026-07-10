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
import { StoriesListClient } from "../StoriesListClient";
import { type StoriesListPaginated } from "./actions";
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
        <div className="paper-card relative overflow-hidden p-6 md:p-8">
          <header className="relative flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-chusa">
                Story Audio
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
                Danh sách truyện
              </h1>
              <p className="font-serif text-sm leading-relaxed text-ink-soft md:text-base">
                Khám phá thư viện, mở từng truyện để đọc và nghe — giao diện gọn, tập trung vào nội dung.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 md:justify-end">
              <Link
                href="/"
                className="rounded-lg border border-line bg-paper-raised px-4 py-2.5 text-sm font-medium text-ink transition hover:border-chusa/40 hover:text-chusa focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chusa"
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
