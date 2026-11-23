"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { DUPLICATE_HOLIDAY, normalizeHolidayName, validateHoliday } from "@/lib/holidays/rules";
import { createClient } from "@/lib/supabase/server";

// BR-49. Writes use the admin's own session; RLS (holidays_*_admin) enforces the role.

export type HolidayActionResult = { ok: true } | { ok: false; error: string };

const FAILED = "บันทึกวันหยุดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

export async function createHoliday(input: { date: string; name: string }): Promise<HolidayActionResult> {
  await requireAdmin();
  const errors = validateHoliday(input);
  const first = errors.date ?? errors.name;
  if (first) return { ok: false, error: first };

  const supabase = await createClient();
  const { error } = await supabase
    .from("holidays")
    .insert({ holiday_date: input.date, name: normalizeHolidayName(input.name) });
  if (error) return { ok: false, error: error.code === "23505" ? DUPLICATE_HOLIDAY : FAILED };
  refresh();
  return { ok: true };
}

export async function deleteHoliday(id: string): Promise<HolidayActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("holidays").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: "ลบวันหยุดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  if (data.length !== 1) return { ok: false, error: "ไม่พบวันหยุดนี้ อาจถูกลบไปแล้ว" };
  refresh();
  return { ok: true };
}
