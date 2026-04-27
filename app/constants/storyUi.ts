/**
 * Màu / token UI truyện–chương bám theo frontend (Tailwind zinc + indigo, globals.app-bg).
 */
export type StoryUiPalette = {
  screenBg: string;
  shellBg: string;
  shellBorder: string;
  text: string;
  textMuted: string;
  textSecondary: string;
  divide: string;
  error: string;
  indigo50: string;
  indigo100: string;
  indigo200: string;
  indigo600: string;
  indigo700: string;
  indigo800: string;
  indigo900: string;
  indigoTextOnSoft: string;
  zinc100: string;
  zinc200: string;
  zinc300: string;
  zinc400: string;
  zinc500: string;
  zinc600: string;
  zinc700: string;
  zinc800: string;
  zinc900: string;
  white: string;
  primaryButton: string;
  primaryButtonText: string;
  pillBorder: string;
  pillBg: string;
  chapterRowBg: string;
  chapterRowHover: string;
  accentBarLeft: string;
  accentBarMid: string;
  accentBarRight: string;
  shadowColor: string;
};

export function storyUiPalette(scheme: "light" | "dark"): StoryUiPalette {
  if (scheme === "dark") {
    return {
      screenBg: "#09090b",
      shellBg: "rgba(24, 24, 27, 0.78)",
      shellBorder: "rgba(39, 39, 42, 0.85)",
      text: "#fafafa",
      textMuted: "#a1a1aa",
      textSecondary: "#d4d4d8",
      divide: "rgba(39, 39, 42, 0.95)",
      error: "#fca5a5",
      indigo50: "rgba(30, 27, 75, 0.45)",
      indigo100: "rgba(49, 46, 129, 0.5)",
      indigo200: "rgba(67, 56, 202, 0.55)",
      indigo600: "#818cf8",
      indigo700: "#a5b4fc",
      indigo800: "rgba(55, 48, 163, 0.85)",
      indigo900: "#c7d2fe",
      indigoTextOnSoft: "#e0e7ff",
      zinc100: "rgba(39, 39, 42, 0.9)",
      zinc200: "#3f3f46",
      zinc300: "#52525b",
      zinc400: "#a1a1aa",
      zinc500: "#a1a1aa",
      zinc600: "#d4d4d8",
      zinc700: "#e4e4e7",
      zinc800: "#f4f4f5",
      zinc900: "#fafafa",
      white: "#18181b",
      primaryButton: "#4f46e5",
      primaryButtonText: "#ffffff",
      pillBorder: "rgba(63, 63, 70, 0.95)",
      pillBg: "rgba(24, 24, 27, 0.65)",
      chapterRowBg: "rgba(9, 9, 11, 0.35)",
      chapterRowHover: "rgba(39, 39, 42, 0.55)",
      accentBarLeft: "#6366f1",
      accentBarMid: "#a855f7",
      accentBarRight: "#38bdf8",
      shadowColor: "rgba(0,0,0,0.45)",
    };
  }
  return {
    screenBg: "#f1f5f9",
    shellBg: "rgba(255, 255, 255, 0.88)",
    shellBorder: "rgba(228, 228, 231, 0.95)",
    text: "#18181b",
    textMuted: "#71717a",
    textSecondary: "#52525b",
    divide: "rgba(228, 228, 231, 0.95)",
    error: "#b91c1c",
    indigo50: "#eef2ff",
    indigo100: "#e0e7ff",
    indigo200: "#c7d2fe",
    indigo600: "#4f46e5",
    indigo700: "#4338ca",
    indigo800: "#3730a3",
    indigo900: "#312e81",
    indigoTextOnSoft: "#1e3a8a",
    zinc100: "#f4f4f5",
    zinc200: "#e4e4e7",
    zinc300: "#d4d4d8",
    zinc400: "#a1a1aa",
    zinc500: "#71717a",
    zinc600: "#52525b",
    zinc700: "#3f3f46",
    zinc800: "#27272a",
    zinc900: "#18181b",
    white: "#ffffff",
    primaryButton: "#4f46e5",
    primaryButtonText: "#ffffff",
    pillBorder: "rgba(228, 228, 231, 0.95)",
    pillBg: "rgba(255, 255, 255, 0.85)",
    chapterRowBg: "rgba(255, 255, 255, 0.45)",
    chapterRowHover: "rgba(255, 255, 255, 0.95)",
    accentBarLeft: "#6366f1",
    accentBarMid: "#8b5cf6",
    accentBarRight: "#0ea5e9",
    shadowColor: "rgba(15, 23, 42, 0.08)",
  };
}
