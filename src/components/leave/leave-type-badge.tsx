import { LEAVE_LABEL, type LeaveType } from "@/lib/leave/rules";
import { cn } from "@/lib/utils";

// One pastel per leave type; the label always travels with the colour.
export const LEAVE_STYLE: Record<LeaveType, string> = {
  sick: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900",
  personal: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
  vacation: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900",
  official: "bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:ring-indigo-900",
  maternity: "bg-pink-50 text-pink-800 ring-pink-200 dark:bg-pink-950/50 dark:text-pink-200 dark:ring-pink-900",
  other: "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:ring-slate-800",
};

export function LeaveTypeBadge({ type, className }: { type: LeaveType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        LEAVE_STYLE[type],
        className,
      )}
    >
      {LEAVE_LABEL[type]}
    </span>
  );
}
