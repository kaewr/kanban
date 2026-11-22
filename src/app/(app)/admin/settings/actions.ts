"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

/** FR-19 / BR-10. RLS (app_settings_update_admin) enforces the admin role. */
export async function updateYearSettings(
  yearType: string,
  fiscalStartMonth: number,
): Promise<SettingsActionResult> {
  const admin = await requireAdmin();
  if (yearType !== "calendar" && yearType !== "fiscal") {
    return { ok: false, error: "รูปแบบปีไม่ถูกต้อง" };
  }
  if (!Number.isInteger(fiscalStartMonth) || fiscalStartMonth < 1 || fiscalStartMonth > 12) {
    return { ok: false, error: "เดือนเริ่มปีงบประมาณไม่ถูกต้อง" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ year_type: yearType, fiscal_start_month: fiscalStartMonth, updated_by: admin.id })
    .eq("id", true)
    .select("id");
  if (error || data.length !== 1) {
    return { ok: false, error: "บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  refresh();
  return { ok: true };
}
