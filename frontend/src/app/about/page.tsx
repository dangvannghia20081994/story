import Link from "next/link";
import { FullWidthLayout } from "@/components/layouts";

export default function AboutPage() {
  const stack = [
    "Next.js 15",
    "React 19",
    "Tailwind CSS",
    "Laravel 12",
    "PostgreSQL + Redis",
    "Web Speech API (đọc trình duyệt)",
    "Docker Compose",
  ];

  return (
    <FullWidthLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 md:p-10">
        <div className="rounded-2xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75 md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <Link href="/" className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400">
              ← Trang chủ
            </Link>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              Phiên bản beta
            </span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100 md:text-4xl">Story Audio</h1>
          <p className="mt-3 max-w-3xl text-base text-zinc-600 dark:text-zinc-300 md:text-lg">
            Nền tảng đọc truyện tiếng Việt theo từng chương: có thể nghe file audio nếu có, hoặc đọc bằng giọng trình duyệt; CMS quản lý truyện, chương và nhân vật.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/40">
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">Full-stack</p>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">Frontend — API — Storage</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/40">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">OpenAPI</p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">Docs + Try it tại `/docs/api`</p>
            </div>
            <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/80 p-4 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/40">
              <p className="text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-300">Đọc truyện</p>
              <p className="text-xs text-fuchsia-700/80 dark:text-fuchsia-300/80">Đọc chương trực tiếp trên trình duyệt</p>
            </div>
          </div>
        </div>

        <article className="grid gap-6 text-zinc-700 dark:text-zinc-300 md:grid-cols-2">
          <section className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75">
            <h2 className="mb-3 text-xl font-semibold text-zinc-800 dark:text-zinc-100">Mục tiêu sản phẩm</h2>
            <ul className="space-y-2 text-sm leading-6">
              <li>Nghe file audio hoặc đọc chương bằng giọng trình duyệt khi chưa có bản ghi âm.</li>
              <li>Tối ưu trải nghiệm tạo truyện, quản lý chương và theo dõi trạng thái audio.</li>
              <li>Lexicon CMS để chuẩn hoá từ ngữ theo thể loại truyện.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75">
            <h2 className="mb-3 text-xl font-semibold text-zinc-800 dark:text-zinc-100">Tính năng nổi bật</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">✓</span>
                <span>Đọc chương bằng Web Speech API khi chưa có file audio.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">✓</span>
                <span>Tiền xử lý văn bản qua lexicon để sửa phát âm theo domain truyện.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">✓</span>
                <span>Audio player hỗ trợ nghe từng chương đã có file.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">✓</span>
                <span>Docker Compose đồng bộ backend + frontend (+ Expo tuỳ chọn) để dev nhanh.</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75 md:col-span-2">
            <h2 className="mb-3 text-xl font-semibold text-zinc-800 dark:text-zinc-100">Kiến trúc hệ thống</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-lg bg-blue-100 px-3 py-2 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Frontend</span>
              <span className="text-zinc-400">→</span>
              <span className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Laravel API
              </span>
              <span className="text-zinc-400">→</span>
              <span className="rounded-lg bg-amber-100 px-3 py-2 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Storage / audio (tuỳ chọn)
              </span>
              <span className="text-zinc-400">+</span>
              <span className="rounded-lg bg-purple-100 px-3 py-2 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                Giọng đọc trình duyệt
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75">
            <h2 className="mb-3 text-xl font-semibold text-zinc-800 dark:text-zinc-100">Stack công nghệ</h2>
            <div className="flex flex-wrap gap-2">
              {stack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {tech}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75">
            <h2 className="mb-3 text-xl font-semibold text-zinc-800 dark:text-zinc-100">Luồng sử dụng nhanh</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Tạo truyện từ trang chủ và thêm chương.</li>
              <li>Thiết lập nhân vật trong CMS nếu muốn gắn tên cho thoại.</li>
              <li>Nghe file audio nếu đã có, hoặc bật đọc bằng trình duyệt.</li>
              <li>Theo dõi trạng thái chương trên danh sách.</li>
            </ol>
          </section>
        </article>

        <section className="rounded-2xl border border-white/70 bg-white/75 p-6 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75">
          <h2 className="mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Thông tin thêm</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Backend cung cấp OpenAPI docs tại <code>/docs/api</code> để test API nhanh.
          </p>
        </section>
        <footer className="border-t border-zinc-200/70 pt-6 text-center text-sm text-zinc-500 dark:border-zinc-700/70">
          <p>© 2026 Story Audio. Built with care for long-form storytelling.</p>
        </footer>
      </div>
    </FullWidthLayout>
  );
}