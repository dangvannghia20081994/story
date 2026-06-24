import Link from "next/link";

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
