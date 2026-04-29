/**
 * Chuẩn hoá HTML chương → plain text (gần với WorkerTtsQueue::plainTextFromChapter) để áp lexicon / TTS.
 */
export function chapterHtmlToTtsPlain(html: string): string {
  const raw = html ?? "";
  if (!raw.trim()) return "";

  const normalized = raw.replace(/<\s*br\s*\/?>/gi, "\n");

  let plain: string;
  if (typeof document !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(`<div>${normalized}</div>`, "text/html");
      plain = doc.body.textContent ?? "";
    } catch {
      plain = normalized.replace(/<[^>]+>/g, " ");
    }
  } else {
    plain = normalized.replace(/<[^>]+>/g, " ");
  }

  plain = plain.replace(/[\u200B-\u200D\uFEFF]/g, "");
  plain = plain.replace(/[ \t\u00A0]+/g, " ");
  const lines = plain.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const joined = lines.join(" ");
  return joined.replace(/\s+/g, " ").trim();
}
