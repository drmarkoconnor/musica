"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AudioLines,
  Archive,
  FileStack,
  Home,
  Library,
  ListMusic,
  LogOut,
  Mic2,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./language-toggle";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const navItems: NavItem[] = [
    { href: "/", label: t("dashboard"), icon: Home },
    { href: "/lessons", label: t("lessons"), icon: Mic2 },
    { href: "/from-lessons", label: t("fromLessons"), icon: ListMusic },
    { href: "/repertoire", label: t("repertoire"), icon: Library },
    { href: "/practice", label: t("practiceSession"), icon: Timer },
    { href: "/assets", label: t("assets"), icon: FileStack },
    { href: "/archive", label: t("archiveArea"), icon: Archive },
    { href: "/recordings", label: t("recordings"), icon: AudioLines },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7f4] text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="flex items-center gap-3" href="/">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-950 text-lg font-semibold text-white">
                PL
              </span>
              <span>
                <span className="block text-lg font-semibold leading-none text-stone-950">
                  {t("appName")}
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">
                  Mark / Leo
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageToggle compact />
              <form action="/api/auth/logout" method="post">
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300 text-stone-600 transition hover:bg-stone-100 hover:text-stone-950"
                  title={t("signOut")}
                  type="submit"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  <span className="sr-only">{t("signOut")}</span>
                </button>
              </form>
            </div>
          </div>
          <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-emerald-950 text-white"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
