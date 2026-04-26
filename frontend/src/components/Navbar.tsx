"use client";

import Link from "next/link";
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

  return (
    <nav className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-indigo-600 dark:text-indigo-400">
          <span>📖</span>
          <span>Story Audio</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeToggle />
          {navItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`text-sm transition-colors ${
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
      </div>
    </nav>
  );
}