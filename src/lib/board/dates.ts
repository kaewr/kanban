import { TIME_ZONE } from "./constants";

/** Calendar date (YYYY-MM-DD) in Asia/Bangkok for an instant. */
export function bangkokDate(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Start of a Bangkok calendar day as an ISO timestamp. */
export function bangkokDayStart(date: string): string {
  return new Date(`${date}T00:00:00+07:00`).toISOString();
}

/**
 * Converts a date picked in a form back to a timestamp. Keeps the original instant
 * when the day is unchanged (so "today" keeps the real time), otherwise uses the
 * start of the picked day.
 */
export function dateInputToTimestamp(date: string, original: string | null): string {
  if (original && bangkokDate(original) === date) return original;
  return bangkokDayStart(date);
}

/** Whole days from one calendar date to another (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Thai display, e.g. "21 พ.ย. 2569". Accepts YYYY-MM-DD or an ISO timestamp. */
export function formatThaiDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : new Date(value);
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
