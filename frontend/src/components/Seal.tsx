/**
 * Con dấu son — chấm phá thương hiệu "Mực & Ấn".
 * Dùng làm logo, tem "có audio", đánh dấu chương đang đọc.
 * Glyph mặc định 書 (thư/sách) — đổi dễ nếu cần.
 */
type SealProps = {
  glyph?: string;
  /** cạnh vuông, px */
  size?: number;
  className?: string;
  title?: string;
};

export function Seal({ glyph = "書", size = 34, className = "", title }: SealProps) {
  return (
    <span
      className={`seal shrink-0 select-none ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.52) }}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {glyph}
    </span>
  );
}
