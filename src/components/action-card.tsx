import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ActionCard({
  href,
  icon: Icon,
  title,
  detail,
  tone = "green",
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  tone?: "green" | "blue";
}) {
  return (
    <Link
      className={cn(
        "group flex min-h-40 flex-col justify-between rounded-lg border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        tone === "green"
          ? "border-emerald-200 bg-emerald-950 text-white"
          : "border-sky-200 bg-sky-950 text-white",
      )}
      href={href}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-white/12">
          <Icon aria-hidden="true" className="h-6 w-6" />
        </span>
        <ArrowRight
          aria-hidden="true"
          className="h-5 w-5 transition group-hover:translate-x-1"
        />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
        <p className="text-sm leading-6 text-white/78">{detail}</p>
      </div>
    </Link>
  );
}
