// BR-40..44 leave rules shared by the leave page, its server actions and the dashboard.

export const LEAVE_TYPES = ["sick", "personal", "vacation", "official", "maternity", "other"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_LABEL: Record<LeaveType, string> = {
  sick: "ลาป่วย",
  personal: "ลากิจ",
  vacation: "ลาพักผ่อน",
  official: "ลาราชการ",
  maternity: "ลาคลอด",
  other: "อื่น ๆ",
};

export const LEAVE_NOTE_MAX = 200;
export const LEAVE_MAX_DAYS = 366; // calendar days in one record (matches the DB check)

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function* eachDay(start: string, end: string): Generator<Date> {
  for (let d = toUtc(start); d <= toUtc(end); d = new Date(d.getTime() + 86_400_000)) yield d;
}

const isWorkingDay = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6; // BR-41: Mon–Fri

/** BR-41: number of Monday–Friday days in an inclusive date range. */
export function workingDays(start: string, end: string): number {
  let n = 0;
  for (const d of eachDay(start, end)) if (isWorkingDay(d)) n++;
  return n;
}

/** Working days per month ("YYYY-MM"), for ranges that cross months (BR-43). */
export function workingDaysByMonth(start: string, end: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const d of eachDay(start, end)) {
    if (!isWorkingDay(d)) continue;
    const key = d.toISOString().slice(0, 7);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

export type LeaveInput = { leaveType: string; startDate: string; endDate: string; note: string };
export type LeaveErrors = Partial<Record<keyof LeaveInput, string>>;

export function normalizeNote(raw: string): string | null {
  const note = raw.trim().replace(/\s+/g, " ");
  return note.length > 0 ? note : null;
}

export function validateLeave(input: LeaveInput): LeaveErrors {
  const errors: LeaveErrors = {};
  if (!(LEAVE_TYPES as readonly string[]).includes(input.leaveType)) errors.leaveType = "กรุณาเลือกประเภทการลา";
  const validStart = DATE.test(input.startDate) && !Number.isNaN(toUtc(input.startDate).getTime());
  const validEnd = DATE.test(input.endDate) && !Number.isNaN(toUtc(input.endDate).getTime());
  if (!validStart) errors.startDate = "กรุณาเลือกวันที่เริ่มลา";
  if (!validEnd) errors.endDate = "กรุณาเลือกวันที่สิ้นสุด";
  if (validStart && validEnd) {
    const span = (toUtc(input.endDate).getTime() - toUtc(input.startDate).getTime()) / 86_400_000;
    if (span < 0) errors.endDate = "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม";
    else if (span >= LEAVE_MAX_DAYS) errors.endDate = "ช่วงวันลายาวเกินไป";
    else if (workingDays(input.startDate, input.endDate) === 0) errors.endDate = "ช่วงที่เลือกไม่มีวันทำการ (จันทร์–ศุกร์)";
  }
  if ((normalizeNote(input.note) ?? "").length > LEAVE_NOTE_MAX) {
    errors.note = `หมายเหตุยาวได้ไม่เกิน ${LEAVE_NOTE_MAX} ตัวอักษร`;
  }
  return errors;
}
