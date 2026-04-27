"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Trang chủ" },
  { href: "/stories", label: "Truyện" },
  { href: "/rankings", label: "Bảng xếp hạng" },
  { href: "/members", label: "Thành viên" },
  { href: "/about", label: "Giới thiệu" },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const mobileMenu =
    mounted && menuOpen ? (
      <>
        {/* Lớp mờ phía sau drawer — nền đặc, z cao để không bị sticky header / nội dung ghi đè */}
        <button
          type="button"
          className="fixed inset-0 top-14 z-[200] bg-zinc-950/75 dark:bg-black/80 md:hidden"
          aria-label="Đóng menu"
          onClick={() => setMenuOpen(false)}
        />
        <aside
          id="mobile-nav-menu"
          className="fixed left-0 top-14 z-[210] flex h-[calc(100dvh-3.5rem)] w-[min(20rem,calc(100vw-1rem))] flex-col border-r border-zinc-200 bg-white shadow-[4px_0_24px_-4px_rgba(0,0,0,0.2)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[4px_0_32px_-4px_rgba(0,0,0,0.5)] md:hidden"
          role="navigation"
          aria-label="Menu chính"
        >
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3 sm:px-4">
            {navItems.map((item) => {
              const isActive = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-xl border px-3 py-3.5 text-base font-medium transition ${
                    isActive
                      ? "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100"
                      : "border-transparent bg-zinc-50 text-zinc-900 hover:border-zinc-200 hover:bg-white dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </aside>
      </>
    ) : null;

  return (
    <nav
      className={`sticky top-0 border-b border-white/60 bg-white/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/70 ${
        menuOpen ? "z-[220]" : "z-50"
      }`}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:px-4 md:px-6">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-1.5 text-base font-bold text-indigo-600 dark:text-indigo-400 sm:gap-2 sm:text-lg"
        >
          <span className="shrink-0" aria-hidden>
            📖
          </span>
          <span className="truncate sm:whitespace-normal">Story Audio</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex md:gap-4">
          <ThemeToggle />
          {navItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`whitespace-nowrap text-sm transition-colors ${
                  isActive
                    ? "font-semibold text-indigo-600 dark:text-indigo-400"
                    : "text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="relative z-[230] flex shrink-0 items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200/90 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mounted && menuOpen ? createPortal(mobileMenu, document.body) : null}
    </nav>
  );
}
