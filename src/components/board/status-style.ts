import {
  CalendarRangeIcon,
  CircleCheckBigIcon,
  ListTodoIcon,
  ScanEyeIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";
import type { TaskPriority, TaskStatus } from "@/types/domain";

/**
 * Pastel look per column. Purple is kept for the brand, so no status uses it.
 * Text colours are the 800/900 shade of the same hue to stay readable (WCAG AA).
 */
export const STATUS_STYLE: Record<
  TaskStatus,
  { icon: LucideIcon; column: string; pill: string; dot: string; dropRing: string }
> = {
  long_term: {
    icon: CalendarRangeIcon,
    column: "bg-indigo-50 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-950/30 dark:ring-indigo-900/40",
    pill: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100",
    dot: "bg-indigo-400",
    dropRing: "ring-indigo-300",
  },
  short_term: {
    icon: ListTodoIcon,
    column: "bg-sky-50 ring-1 ring-inset ring-sky-100 dark:bg-sky-950/30 dark:ring-sky-900/40",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-100",
    dot: "bg-sky-400",
    dropRing: "ring-sky-300",
  },
  in_progress: {
    icon: TimerIcon,
    column: "bg-amber-50 ring-1 ring-inset ring-amber-100 dark:bg-amber-950/30 dark:ring-amber-900/40",
    pill: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
    dot: "bg-amber-400",
    dropRing: "ring-amber-300",
  },
  review: {
    icon: ScanEyeIcon,
    column: "bg-rose-50 ring-1 ring-inset ring-rose-100 dark:bg-rose-950/30 dark:ring-rose-900/40",
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100",
    dot: "bg-rose-400",
    dropRing: "ring-rose-300",
  },
  done: {
    icon: CircleCheckBigIcon,
    column: "bg-emerald-50 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900/40",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100",
    dot: "bg-emerald-400",
    dropRing: "ring-emerald-300",
  },
};

export const PRIORITY_STYLE: Record<TaskPriority, string> = {
  1: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900",
  2: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
  3: "bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:ring-slate-800",
};
