import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

/** Trước hydration; Next chèn vào HTML gốc (không dùng <head> tay — tránh ghi đè metadata/viewport). */
const themeInitScript = `(function(){try{var k='story-theme',t=localStorage.getItem(k),m=window.matchMedia('(prefers-color-scheme: dark)'),d=t==='dark'||(t!=='light'&&((t===null||t==='')&&m.matches)),r=document.documentElement;if(d){r.classList.add('dark');r.style.colorScheme='dark'}else{r.classList.remove('dark');r.style.colorScheme='light'}}catch(e){}})();`;

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

/** Cho `env(safe-area-inset-*)` (home indicator / tai thỏ) — dock dưới không bị che. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
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
