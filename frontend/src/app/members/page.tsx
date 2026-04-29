import Link from "next/link";
import { FullWidthLayout } from "@/components/layouts";

export default function MembersPage() {
  return (
    <FullWidthLayout>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 md:p-10">
        <header className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/70">
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Thành viên</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Trang này dành cho danh sách người dùng đăng ký trên site và sẽ được bổ sung sau. Nhân vật trong từng truyện nằm ở mục{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Nhân vật</span> trên trang chi tiết truyện.
          </p>
          <p className="mt-4">
            <Link
              href="/stories"
              className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-800 transition hover:border-indigo-300 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:border-indigo-600"
            >
              Danh sách truyện
            </Link>
          </p>
        </header>
      </div>
    </FullWidthLayout>
  );
}
