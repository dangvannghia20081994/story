import Link from "next/link";
import { FullWidthLayout } from "@/components/layouts";

export default function MembersPage() {
  return (
    <FullWidthLayout>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 md:p-10">
        <header className="paper-card p-6">
          <h1 className="font-display text-2xl font-bold text-ink">Thành viên</h1>
          <p className="mt-3 font-serif text-sm leading-relaxed text-ink-soft">
            Trang này dành cho danh sách người dùng đăng ký trên site và sẽ được bổ sung sau. Nhân vật trong từng truyện nằm ở mục{" "}
            <span className="font-medium text-ink">Nhân vật</span> trên trang chi tiết truyện.
          </p>
          <p className="mt-4">
            <Link
              href="/stories"
              className="inline-flex rounded-full border border-chusa/25 bg-chusa/10 px-4 py-2 text-sm font-medium text-chusa transition hover:border-chusa/50 hover:bg-chusa/15"
            >
              Danh sách truyện
            </Link>
          </p>
        </header>
      </div>
    </FullWidthLayout>
  );
}
