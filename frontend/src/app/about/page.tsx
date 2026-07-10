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
        <div className="paper-card p-6 md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <Link href="/" className="text-sm text-ink-soft underline-offset-4 hover:underline">
              ← Trang chủ
            </Link>
            <span className="rounded-full border border-chusa/25 bg-chusa/10 px-3 py-1 text-xs font-semibold text-chusa">
              Phiên bản beta
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">Story Audio</h1>
          <p className="mt-3 max-w-3xl font-serif text-base text-ink-soft md:text-lg">
            Nền tảng đọc truyện tiếng Việt theo từng chương: có thể nghe file audio nếu có, hoặc đọc bằng giọng trình duyệt; CMS quản lý truyện, chương và nhân vật.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-chusa/25 bg-chusa/10 p-4">
              <p className="font-display text-2xl font-bold text-chusa">Full-stack</p>
              <p className="text-xs text-chusa/80">Frontend — API — Storage</p>
            </div>
            <div className="rounded-xl border border-ngoc/25 bg-ngoc/10 p-4">
              <p className="font-display text-2xl font-bold text-ngoc">OpenAPI</p>
              <p className="text-xs text-ngoc/80">Docs + Try it tại `/docs/api`</p>
            </div>
            <div className="rounded-xl border border-chusa/25 bg-chusa/10 p-4">
              <p className="font-display text-2xl font-bold text-chusa">Đọc truyện</p>
              <p className="text-xs text-chusa/80">Đọc chương trực tiếp trên trình duyệt</p>
            </div>
          </div>
        </div>

        <article className="grid gap-6 text-ink-soft md:grid-cols-2">
          <section className="paper-card p-6">
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">Mục tiêu sản phẩm</h2>
            <ul className="space-y-2 font-serif text-sm leading-6">
              <li>Nghe file audio hoặc đọc chương bằng giọng trình duyệt khi chưa có bản ghi âm.</li>
              <li>Tối ưu trải nghiệm tạo truyện, quản lý chương và theo dõi trạng thái audio.</li>
              <li>Lexicon CMS để chuẩn hoá từ ngữ theo thể loại truyện.</li>
            </ul>
          </section>

          <section className="paper-card p-6">
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">Tính năng nổi bật</h2>
            <ul className="space-y-2 font-serif text-sm">
              <li className="flex items-start gap-2">
                <span className="text-chusa">✓</span>
                <span>Đọc chương bằng Web Speech API khi chưa có file audio.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-chusa">✓</span>
                <span>Tiền xử lý văn bản qua lexicon để sửa phát âm theo domain truyện.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-chusa">✓</span>
                <span>Audio player hỗ trợ nghe từng chương đã có file.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-chusa">✓</span>
                <span>Docker Compose đồng bộ backend + frontend (+ Expo tuỳ chọn) để dev nhanh.</span>
              </li>
            </ul>
          </section>

          <section className="paper-card p-6 md:col-span-2">
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">Kiến trúc hệ thống</h2>
            <div className="flex flex-wrap items-center gap-3 font-serif text-sm">
              <span className="rounded-lg border border-chusa/25 bg-chusa/10 px-3 py-2 text-chusa">Frontend</span>
              <span className="text-ink-faint">→</span>
              <span className="rounded-lg border border-ngoc/25 bg-ngoc/10 px-3 py-2 text-ngoc">
                Laravel API
              </span>
              <span className="text-ink-faint">→</span>
              <span className="rounded-lg border border-chusa/25 bg-chusa/10 px-3 py-2 text-chusa">
                Storage / audio (tuỳ chọn)
              </span>
              <span className="text-ink-faint">+</span>
              <span className="rounded-lg border border-chusa/25 bg-chusa/10 px-3 py-2 text-chusa">
                Giọng đọc trình duyệt
              </span>
            </div>
          </section>

          <section className="paper-card p-6">
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">Stack công nghệ</h2>
            <div className="flex flex-wrap gap-2">
              {stack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-line bg-paper-inset px-3 py-1 text-xs font-medium text-ink-soft"
                >
                  {tech}
                </span>
              ))}
            </div>
          </section>

          <section className="paper-card p-6">
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">Luồng sử dụng nhanh</h2>
            <ol className="list-decimal space-y-2 pl-5 font-serif text-sm">
              <li>Tạo truyện từ trang chủ và thêm chương.</li>
              <li>Thiết lập nhân vật trong CMS nếu muốn gắn tên cho thoại.</li>
              <li>Nghe file audio nếu đã có, hoặc bật đọc bằng trình duyệt.</li>
              <li>Theo dõi trạng thái chương trên danh sách.</li>
            </ol>
          </section>
        </article>

        <section className="paper-card p-6">
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">Thông tin thêm</h2>
          <p className="font-serif text-sm text-ink-soft">
            Backend cung cấp OpenAPI docs tại <code>/docs/api</code> để test API nhanh.
          </p>
        </section>
        <footer className="border-t border-line pt-6 text-center text-sm text-ink-faint">
          <p>© 2026 Story Audio. Built with care for long-form storytelling.</p>
        </footer>
      </div>
    </FullWidthLayout>
  );
}
