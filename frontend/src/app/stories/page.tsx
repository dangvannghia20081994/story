import Link from "next/link";
import { FullWidthLayout } from "@/components/layouts";
import { StoriesList } from "../StoriesList";
import { CreateStoryButton } from "./CreateStoryButton";

export default function StoriesPage() {
  return (
    <FullWidthLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 md:p-10">
        <div className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/70 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">Danh sách truyện</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Xem nhanh trạng thái render audio và truy cập chi tiết từng truyện.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400">
                ← Trang chủ
              </Link>
              <CreateStoryButton />
            </div>
          </div>
        </div>

        <section className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75 md:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
            Tất cả truyện
          </h2>
          <StoriesList />
        </section>
      </div>
    </FullWidthLayout>
  );
}
