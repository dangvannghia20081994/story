/** Khớp `App\Models\Story::GENRE_LABELS` (backend). */
export const GENRE_LABELS: Record<string, string> = {
  "tu-tien": "Tu tiên",
  "huyen-huyen": "Huyền huyễn",
  "kiem-hiep": "Kiếm hiệp",
  "do-thi": "Đô thị",
  khac: "Khác",
};

export function genreLabel(slug: string | null | undefined): string | null {
  if (slug == null || slug === "") return null;
  return GENRE_LABELS[slug] ?? slug;
}
