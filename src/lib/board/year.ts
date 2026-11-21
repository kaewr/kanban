import { TIME_ZONE } from "./constants";
import type { YearType } from "@/types/domain";

const BE_OFFSET = 543;
export const MIN_YEAR = 2543;
export const MAX_YEAR = 2643;

export type YearSettings = { yearType: YearType; fiscalStartMonth: number };

/**
 * BR-09 / BR-10: the current board year in the Buddhist Era.
 * calendar: Jan–Dec. fiscal: named by the year it ends in
 * (start month Oct -> Oct 2569 is fiscal 2570).
 */
export function currentBoardYear(settings: YearSettings, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value) + BE_OFFSET;
  const month = Number(parts.find((p) => p.type === "month")?.value);

  if (settings.yearType === "fiscal" && settings.fiscalStartMonth > 1 && month >= settings.fiscalStartMonth) {
    return year + 1;
  }
  return year;
}

/** FR-12 options: current year ±1 plus every year that has tasks, newest first. */
export function yearOptions(current: number, taskYears: readonly number[]): number[] {
  const set = new Set<number>([current - 1, current, current + 1, ...taskYears]);
  return [...set].filter((y) => y >= MIN_YEAR && y <= MAX_YEAR).sort((a, b) => b - a);
}

export function parseYearParam(raw: unknown, fallback: number): number {
  const value = typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(value) && value >= MIN_YEAR && value <= MAX_YEAR ? value : fallback;
}
