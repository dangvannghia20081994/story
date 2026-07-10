/**
 * Voice-cast: mỗi nhân vật một "sắc mực" ổn định (hash theo tên).
 * Trả về CSS var pigment (đổi theo light/dark trong globals.css).
 * narration / _unknown xử lý riêng ở component đọc.
 */
const PIGMENT_COUNT = 6;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** CSS color var cho tên nhân vật (vd "var(--pg-3)"). */
export function speakerPigment(speaker: string): string {
  const idx = hashString(speaker.trim().toLowerCase()) % PIGMENT_COUNT;
  return `var(--pg-${idx})`;
}
