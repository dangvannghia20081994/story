import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">
            Trang chủ
          </Link>
          <Link href="/stories" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">
            Truyện
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
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} app-bg min-h-screen antialiased`}
      >
        <div className="app-noise fixed inset-0 -z-10 opacity-40" />
        <div className="relative">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  );
}
