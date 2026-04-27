import { genreLabel } from "@/lib/genreLabels";

/** Slug thể loại từ API (ưu tiên `genres`, fallback `genre`). */
export function storyGenreSlugs(story: { genres?: string[] | null; genre?: string | null }): string[] {
  if (Array.isArray(story.genres) && story.genres.length > 0) {
    return story.genres;
  }
  if (story.genre) {
    return [story.genre];
  }
  return [];
}

export function storyBelongsToGenreSlug(
  story: { genres?: string[] | null; genre?: string | null },
  slug: string,
): boolean {
  const slugs = storyGenreSlugs(story);
  if (slugs.length === 0) {
    return slug === "khac";
  }

  return slugs.includes(slug);
}

/** Nhãn hiển thị, cách nhau bởi dấu phẩy. */
export function storyGenresDisplay(story: { genres?: string[] | null; genre?: string | null }): string {
  const labels = storyGenreSlugs(story)
    .map((s) => genreLabel(s))
    .filter((x): x is string => typeof x === "string" && x !== "");
  return labels.length > 0 ? labels.join(", ") : "Khác";
}
