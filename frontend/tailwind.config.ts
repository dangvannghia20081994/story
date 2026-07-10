import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // tương thích cũ
        background: "var(--paper)",
        foreground: "var(--ink)",
        // hệ "Mực & Ấn"
        paper: {
          DEFAULT: "var(--paper)",
          raised: "var(--paper-raised)",
          inset: "var(--paper-inset)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
          faint: "var(--ink-faint)",
        },
        line: "var(--line)",
        chusa: {
          DEFAULT: "var(--chusa)",
          deep: "var(--chusa-deep)",
        },
        ngoc: {
          DEFAULT: "var(--ngoc)",
          deep: "var(--ngoc-deep)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Cambria", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
