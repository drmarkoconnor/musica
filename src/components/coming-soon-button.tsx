"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

type ButtonTone = "primary" | "neutral" | "danger" | "compact";

const toneClasses: Record<ButtonTone, string> = {
  primary:
    "border-stone-300 bg-stone-100 text-stone-500",
  neutral:
    "border-stone-300 bg-stone-100 text-stone-500",
  danger:
    "border-rose-100 bg-rose-50 text-rose-400",
  compact:
    "border-stone-300 bg-stone-100 text-stone-500",
};

export function ComingSoonButton({
  children,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: ButtonTone;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <button
      aria-disabled="true"
      className={cn(
        "inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold opacity-80",
        toneClasses[tone],
        className,
      )}
      disabled
      title={t("comingSoon")}
      type="button"
    >
      {Icon ? <Icon aria-hidden="true" className="h-4 w-4" /> : null}
      <span>{children}</span>
      <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500">
        {t("comingSoon")}
      </span>
    </button>
  );
}
