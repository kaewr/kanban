"use server";

import { requireProfile } from "@/lib/auth";
import { MAX_YEAR, MIN_YEAR } from "@/lib/board/year";
import { createClient } from "@/lib/supabase/server";

export type ClearBoardResult = { ok: true; cleared: number } | { ok: false; error: string };

/** BR-47: soft-delete every one of the caller's own tasks in one board year. */
export async function clearMyBoard(year: number): Promise<ClearBoardResult> {
  await requireProfile();
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return { ok: false, error: "ปีไม่ถูกต้อง" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clear_my_tasks", { p_year: year });
  if (error || typeof data !== "number") {
    return { ok: false, error: "ล้างงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  return { ok: true, cleared: data };
}
