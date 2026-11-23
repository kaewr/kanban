// BR-48 Leave calendar: month grid helpers (pure, Gregorian "YYYY-MM" / "YYYY-MM-DD").
import { THAI_MONTHS } from "@/lib/board/year";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** "YYYY-MM" from the URL, or the fallback when missing or malformed. */
export function parseMonthParam(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const match = MONTH.exec(raw);
  if (!match) return fallback;
  const year = Number(match[1]);
  return year >= 2000 && year <= 2100 ? raw : fallback;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** First and last date of the month. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return { from: `${month}-01`, to: iso(new Date(Date.UTC(y, m, 0))) };
}

/** e.g. "2026-11" -> "พฤศจิกายน 2569" (Buddhist Era). */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

export type CalendarDay = { date: string; day: number; inMonth: boolean; weekend: boolean };

/** Whole weeks (Sunday first, as on Thai wall calendars) covering the month. */
export function monthGrid(month: string): CalendarDay[][] {
  const { from, to } = monthRange(month);
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  const weeks: CalendarDay[][] = [];
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    if (d.getUTCDay() === 0) weeks.push([]);
    weeks[weeks.length - 1]!.push({
      date: iso(d),
      day: d.getUTCDate(),
      inMonth: iso(d).startsWith(month),
      weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
    });
  }
  return weeks;
}

/** Groups items that span a date range onto each day they cover within [from, to]. */
export function spreadByDay<T extends { startDate: string; endDate: string }>(
  items: readonly T[],
  from: string,
  to: string,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const first = item.startDate > from ? item.startDate : from;
    const last = item.endDate < to ? item.endDate : to;
    for (let d = new Date(`${first}T00:00:00Z`); iso(d) <= last; d = new Date(d.getTime() + 86_400_000)) {
      const key = iso(d);
      const list = result.get(key);
      if (list) list.push(item);
      else result.set(key, [item]);
    }
  }
  return result;
}
