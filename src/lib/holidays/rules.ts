// BR-49 Public holidays: symbolic labels only (they do not change leave counts or tasks).

export type Holiday = { id: string; date: string; name: string };

export const HOLIDAY_NAME_MAX = 100;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeHolidayName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export type HolidayErrors = { date?: string; name?: string };

export function validateHoliday(input: { date: string; name: string }): HolidayErrors {
  const errors: HolidayErrors = {};
  if (!DATE.test(input.date) || Number.isNaN(Date.parse(`${input.date}T00:00:00Z`))) {
    errors.date = "กรุณาเลือกวันที่";
  }
  const name = normalizeHolidayName(input.name);
  if (name.length === 0) errors.name = "กรุณากรอกชื่อวันหยุด";
  else if (name.length > HOLIDAY_NAME_MAX) errors.name = `ชื่อวันหยุดยาวได้ไม่เกิน ${HOLIDAY_NAME_MAX} ตัวอักษร`;
  return errors;
}

export const DUPLICATE_HOLIDAY = "วันที่นี้มีวันหยุดอยู่แล้ว";
