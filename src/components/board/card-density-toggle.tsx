"use client";

import { LayoutListIcon, ListIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { compact: false, label: "การ์ดปกติ", icon: LayoutListIcon },
  { compact: true, label: "การ์ดกะทัดรัด", icon: ListIcon },
] as const;

/** BR-50: switch between full and compact cards (remembered in this browser). */
export function CardDensityToggle({ compact, onChange }: { compact: boolean; onChange: (compact: boolean) => void }) {
  return (
    <div role="group" aria-label="รูปแบบการ์ด" className="flex shrink-0 items-center rounded-lg p-0.5 ring-1 ring-foreground/10">
      {OPTIONS.map((o) => {
        const active = o.compact === compact;
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={active}
            title={o.label}
            onClick={() => onChange(o.compact)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm transition-colors",
              active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <o.icon className="size-4" aria-hidden />
            <span className="max-lg:sr-only">{o.compact ? "กะทัดรัด" : "ปกติ"}</span>
          </button>
        );
      })}
    </div>
  );
}
