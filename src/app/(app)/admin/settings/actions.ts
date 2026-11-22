"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

/** FR-19 (changed 22 Nov 2026): the shared fiscal start month. RLS enforces the admin role. */
export async function updateFiscalStartMonth(fiscalStartMonth: number): Promise<SettingsActionResult> {
  const admin = await requireAdmin();
  if (!Number.isInteger(fiscalStartMonth) || fiscalStartMonth < 1 || fiscalStartMonth > 12) {
    return { ok: false, error: "เดือนเริ่มปีงบประมาณไม่ถูกต้อง" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ fiscal_start_month: fiscalStartMonth, updated_by: admin.id })
    .eq("id", true)
    .select("id");
  if (error || data.length !== 1) {
    return { ok: false, error: "บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  refresh();
  return { ok: true };
}
