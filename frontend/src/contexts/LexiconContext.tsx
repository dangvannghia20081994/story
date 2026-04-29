"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { LexiconRow } from "@/lib/applyLexicons";
import { applyLexiconsToPlainText, sortLexiconEntries } from "@/lib/applyLexicons";
import { chapterHtmlToTtsPlain } from "@/lib/chapterPlainText";
import { fetchAllLexiconRows } from "@/lib/lexiconApi";

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

export function LexiconProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LexiconRow[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAllLexiconRows();
        if (!cancelled) {
          setEntries(sortLexiconEntries(rows));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ entries, ready, error }), [entries, ready, error]);

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
