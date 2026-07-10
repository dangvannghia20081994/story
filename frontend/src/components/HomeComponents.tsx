import Link from "next/link";
import { Seal } from "@/components/Seal";

/**
 * Trang bìa (frontispiece) — mở đầu bằng thứ đặc trưng nhất của sản phẩm:
 * audio phân vai. Cột phải là một trích đoạn hiện đúng cách reader thể hiện lời thoại.
 */
export function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-paper-raised">
      {/* mực loang rất mờ ở hai góc — khí chất, không lòe loẹt */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          background:
            "radial-gradient(60% 55% at 88% 8%, color-mix(in srgb, var(--chusa) 14%, transparent), transparent 70%), radial-gradient(50% 60% at 4% 100%, color-mix(in srgb, var(--ngoc) 12%, transparent), transparent 72%)",
        }}
        aria-hidden
      />
      <div className="relative grid gap-8 p-7 md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-10 md:p-12">
        <div>
          <div className="mb-5 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-ink-faint">
            <Seal size={24} />
            <span>Tàng thư · nghe truyện tiên hiệp</span>
          </div>

          <h1 className="font-display text-[2.15rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl md:text-[3.35rem]">
            Mỗi nhân vật
            <br />
            một giọng nói.
          </h1>

          <div className="rule-ink my-6 w-40" />

          <p className="max-w-md font-serif text-[1.05rem] leading-relaxed text-ink-soft">
            Đọc và nghe truyện tu tiên với giọng AI phân vai từng nhân vật —
            lời kể, lời thoại, tách bạch như một vở diễn trên trang giấy.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/stories"
              className="inline-flex items-center gap-2 rounded-lg bg-chusa px-6 py-3 font-semibold text-[#f6ede0] shadow-sm transition hover:bg-chusa-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chusa"
            >
              Vào tàng thư
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper px-6 py-3 font-semibold text-ink transition hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/40"
            >
              Cách hoạt động
            </Link>
          </div>
        </div>

        <CastPreview />
      </div>
    </section>
  );
}

/** Trích đoạn minh hoạ voice-cast — đúng ngôn ngữ thị giác của trang đọc. */
function CastPreview() {
  const lines: Array<{ speaker: string | null; pigment?: string; text: string }> = [
    { speaker: null, text: "Trên đỉnh Thái Hư, mây trắng cuộn quanh chân người tu đạo." },
    { speaker: "Hàn Lập", pigment: "var(--pg-1)", text: "Cảnh giới này… ta phải bước tiếp." },
    { speaker: "Nam Cung Uyển", pigment: "var(--pg-3)", text: "Đạo hữu, coi chừng kiếp lôi sắp tới." },
    { speaker: null, text: "Tiếng sấm rền vang, kiếm quang xé toạc tầng mây." },
  ];

  return (
    <figure className="paper-card relative p-5 md:p-6">
      <figcaption className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <span className="font-display text-sm font-bold text-ink">Phàm Nhân Tu Tiên</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ngoc/12 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-ngoc">
          <span className="h-1.5 w-1.5 rounded-full bg-ngoc" aria-hidden />
          Có audio
        </span>
      </figcaption>

      <div className="space-y-3.5 font-serif text-[0.95rem] leading-relaxed">
        {lines.map((line, i) =>
          line.speaker === null ? (
            <p key={i} className="italic text-ink-soft">
              {line.text}
            </p>
          ) : (
            <p key={i} className="border-l-2 pl-3.5" style={{ borderColor: line.pigment }}>
              <span
                className="mr-1.5 font-display text-[0.7rem] font-bold uppercase tracking-wide"
                style={{ color: line.pigment }}
              >
                {line.speaker}
              </span>
              <span className="text-ink">“{line.text}”</span>
            </p>
          ),
        )}
      </div>
    </figure>
  );
}
