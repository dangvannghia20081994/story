"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { LexiconRow } from "@/lib/applyLexicons";
import { applyLexiconsToPlainText, sortLexiconEntries } from "@/lib/applyLexicons";
import { chapterHtmlToTtsPlain } from "@/lib/chapterPlainText";

type LexiconContextValue = {
  entries: LexiconRow[];
  ready: boolean;
  error: Error | null;
};

const LexiconContext = createContext<LexiconContextValue>({
  entries: [],
  ready: false,
  error: null,
});

type LexiconProviderProps = {
  children: ReactNode;
  initialEntries: LexiconRow[];
};

export function LexiconProvider({ children, initialEntries }: LexiconProviderProps) {
  const value = useMemo(
    () => ({ entries: sortLexiconEntries(initialEntries), ready: true, error: null }),
    [initialEntries],
  );

  return <LexiconContext.Provider value={value}>{children}</LexiconContext.Provider>;
}

export function useLexiconContext(): LexiconContextValue {
  return useContext(LexiconContext);
}

/** Plain text chương (strip HTML) rồi áp lexicon khi đã tải xong danh sách. */
export function chapterPlainWithLexicons(html: string, entries: LexiconRow[], lexiconReady: boolean): string {
  const plain = chapterHtmlToTtsPlain(html);
  if (!lexiconReady || entries.length === 0) return plain;
  return applyLexiconsToPlainText(plain, entries);
}

export function useChapterPlainWithLexicons(html: string): string {
  const { entries, ready } = useLexiconContext();
  return useMemo(() => chapterPlainWithLexicons(html, entries, ready), [html, entries, ready]);
}
