export type LexiconRow = {
  id: number;
  word: string;
  replacement: string;
  type: string;
  priority: number;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sortLexiconEntries(entries: LexiconRow[]): LexiconRow[] {
  return [...entries].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.word.length - a.word.length;
  });
}

/** Áp lexicon lên plain text (ưu tiên priority, từ dài trước). */
export function applyLexiconsToPlainText(plain: string, entries: LexiconRow[]): string {
  let out = plain.replace(/\s+/g, " ").trim();
  if (!out || entries.length === 0) return out;

  const sorted = sortLexiconEntries(entries);
  for (const row of sorted) {
    const w = row.word?.trim() ?? "";
    if (!w) continue;
    let rep = row.replacement ?? "";
    if (row.type === "filter" && rep === "") {
      rep = "";
    }
    try {
      const pattern = new RegExp(escapeRegExp(w), "giu");
      out = out.replace(pattern, rep);
    } catch {
      /* bỏ qua mẫu không hợp lệ */
    }
  }
  return out.replace(/\s+/g, " ").trim();
}
