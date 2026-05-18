"use client";

import { useLanguage } from "@/lib/language";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";

const options: Array<{ locale: Locale; label: string }> = [
  { locale: "en", label: "English" },
  { locale: "it", label: "Italiano" },
];

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div aria-label={t("language")} className="inline-flex rounded-md border border-stone-300 bg-white p-1 shadow-sm">
      {options.map((option) => (
        <button
          aria-pressed={locale === option.locale}
          className={cn(
            "rounded px-3 py-1.5 text-sm font-medium transition",
            compact && "px-2 py-1 text-xs",
            locale === option.locale
              ? "bg-emerald-900 text-white"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
          )}
          key={option.locale}
          onClick={() => setLocale(option.locale)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
