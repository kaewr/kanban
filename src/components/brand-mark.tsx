import { SquareKanbanIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** App logo: purple tile with a gold corner accent. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <SquareKanbanIcon className="size-[60%]" strokeWidth={2.25} />
      <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-brand-gold ring-2 ring-background" />
    </span>
  );
}
