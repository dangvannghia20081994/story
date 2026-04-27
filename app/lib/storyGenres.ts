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

export function storyGenresLine(story: { genres?: string[] | null; genre?: string | null }): string {
  const labels = storyGenreSlugs(story)
    .map((s) => genreLabel(s))
    .filter((x): x is string => typeof x === "string" && x !== "");
  return labels.length > 0 ? labels.join(" · ") : "—";
}
