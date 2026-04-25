import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const themeInitScript = `(function(){try{var k='story-theme',t=localStorage.getItem(k);if(t==='dark'||(t!=='light'&&(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches))){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Story Audio - Nghe Truyện Tiên Hiệp",
  description: "Nền tảng đọc truyện bằng âm thanh với AI",
};

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-indigo-600 dark:text-indigo-400">
          <span>📖</span>
          <span>Story Audio</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeToggle />
          <Link href="/" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">
            Trang chủ
          </Link>
          <Link href="/stories" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">
            Truyện
          </Link>
          <Link href="/rankings" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">
            Bảng xếp hạng
          </Link>
          <Link href="/members" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">
            Thành viên
          </Link>
          <Link href="/about" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">
            Giới thiệu
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} app-bg min-h-screen antialiased`}
      >
        <Script id="story-theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <div className="app-noise fixed inset-0 -z-10 opacity-40" />
        <div className="relative">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  );
}
