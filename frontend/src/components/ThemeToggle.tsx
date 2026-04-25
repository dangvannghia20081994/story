"use client";

import { useCallback, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "story-theme";

function applyTheme(mode: "light" | "dark") {
  document.documentElement.classList.toggle("dark", mode === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    const next = mode === "dark" ? "light" : "dark";
    applyTheme(next);
    setMode(next);
  }, [mode]);

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/90 bg-white/90 text-zinc-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-200"
      aria-label={isDark ? "Chế độ sáng" : "Chế độ tối"}
      title={isDark ? "Sáng" : "Tối"}
    >
      {!ready ? (
        <span className="h-4 w-4 rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden />
      ) : isDark ? (
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
