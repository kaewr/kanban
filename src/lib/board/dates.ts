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

/** BR-58: value for <input type="datetime-local"> (YYYY-MM-DDTHH:mm) in Bangkok time. */
export function toDateTimeInput(instant: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * BR-58: a datetime-local value (Bangkok) back to a timestamp. Keeps the original instant
 * when the minute is unchanged, so untouched fields keep their seconds.
 */
export function dateTimeInputToTimestamp(value: string, original: string | null): string {
  if (original && toDateTimeInput(original) === value) return original;
  return new Date(`${value}:00+07:00`).toISOString();
}

/** BR-58: Thai date with time, e.g. "23 พ.ย. 2569 09:05". */
export function formatThaiDateTime(instant: string): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
  return `${formatThaiDate(instant)} ${time}`;
}

/** Whole days from one calendar date to another (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Thai display with the weekday, e.g. "อ. 13 ต.ค. 2569", for a YYYY-MM-DD date. */
export function formatThaiWeekdayDate(date: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00+07:00`));
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
