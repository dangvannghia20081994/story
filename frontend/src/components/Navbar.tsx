"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Seal } from "@/components/Seal";

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
          className="fixed inset-0 top-14 z-[200] bg-black/50 dark:bg-black/70 md:hidden"
          aria-label="Đóng menu"
          onClick={() => setMenuOpen(false)}
        />
        <aside
          id="mobile-nav-menu"
          className="fixed left-0 top-14 z-[210] flex h-[calc(100dvh-3.5rem)] w-[min(20rem,calc(100vw-1rem))] flex-col border-r border-line bg-paper-raised shadow-[4px_0_28px_-6px_rgba(33,30,26,0.35)] md:hidden"
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
                  className={`rounded-lg border px-3 py-3.5 text-base transition ${
                    isActive
                      ? "border-chusa/30 bg-chusa/10 font-semibold text-chusa"
                      : "border-transparent bg-paper text-ink hover:border-line hover:bg-paper-inset"
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
      className={`sticky top-0 border-b border-line bg-paper/85 backdrop-blur-md ${
        menuOpen ? "z-[220]" : "z-50"
      }`}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:px-4 md:px-6">
        <Link
          href="/"
          className="group flex min-w-0 shrink items-center gap-2.5"
          aria-label="Story Audio — trang chủ"
        >
          <Seal size={30} className="transition-transform duration-300 group-hover:rotate-0" />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate font-display text-[0.95rem] font-bold tracking-tight text-ink sm:text-lg">
              Story Audio
            </span>
            <span className="hidden text-[0.6rem] font-medium uppercase tracking-[0.22em] text-ink-faint sm:block">
              Tàng thư · nghe truyện
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-5 md:flex">
          {navItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative whitespace-nowrap text-sm transition-colors ${
                  isActive
                    ? "font-semibold text-chusa"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {item.label}
                {isActive ? (
                  <span className="absolute -bottom-[7px] left-0 h-[2px] w-full rounded-full bg-chusa" aria-hidden />
                ) : null}
              </Link>
            );
          })}
          <span className="h-5 w-px bg-line" aria-hidden />
          <ThemeToggle />
        </div>

        <div className="relative z-[230] flex shrink-0 items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-paper-raised text-ink-soft shadow-sm transition hover:border-chusa/40 hover:text-chusa"
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
