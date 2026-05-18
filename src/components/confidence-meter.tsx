import { cn } from "@/lib/utils";
import type { Confidence } from "@/lib/types";

export function ConfidenceMeter({ value }: { value: Confidence }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Confidence ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          className={cn(
            "h-2.5 w-6 rounded-sm",
            step <= value ? "bg-emerald-800" : "bg-stone-200",
          )}
          key={step}
        />
      ))}
    </div>
  );
}
