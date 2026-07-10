import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Spectral } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { AppProviders } from "@/app/AppProviders";
import "./globals.css";

/** Trước hydration; Next chèn vào HTML gốc (không dùng <head> tay — tránh ghi đè metadata/viewport). */
const themeInitScript = `(function(){try{var k='story-theme',t=localStorage.getItem(k),m=window.matchMedia('(prefers-color-scheme: dark)'),d=t==='dark'||(t!=='light'&&((t===null||t==='')&&m.matches)),r=document.documentElement;if(d){r.classList.add('dark');r.style.colorScheme='dark'}else{r.classList.remove('dark');r.style.colorScheme='light'}}catch(e){}})();`;

/** Bricolage — tiêu đề & UI (chất hiện đại, đủ dấu tiếng Việt). */
const fontDisplay = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

/** Spectral — mặt chữ đọc dài (serif văn học, tối ưu màn hình). */
const fontSerif = Spectral({
  variable: "--font-serif",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
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
        className={`${fontDisplay.variable} ${fontSerif.variable} app-paper min-h-screen font-sans text-ink antialiased`}
      >
        <div className="relative">
          <AppProviders>
            <Navbar />
            {children}
          </AppProviders>
        </div>
      </body>
    </html>
  );
}
