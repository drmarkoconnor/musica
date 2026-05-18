import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Section({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-2xl font-semibold leading-tight text-stone-950">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
