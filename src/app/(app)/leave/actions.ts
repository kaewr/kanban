"use server";

import { refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { normalizeNote, validateLeave, type LeaveErrors, type LeaveType } from "@/lib/leave/rules";
import { createClient } from "@/lib/supabase/server";

// BR-40..44. Writes use the caller's session: RLS lets users touch only their own
// leaves and admins everyone's; the DB trigger rejects overlapping ranges (BR-42).

export type LeaveActionResult = { ok: true } | { ok: false; error: string; fields?: LeaveErrors };

const FAILED = "บันทึกวันลาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

export async function saveLeave(input: {
  id?: string;
  ownerId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  note: string;
}): Promise<LeaveActionResult> {
  const profile = await requireProfile();
  if (input.ownerId !== profile.id && profile.role !== "admin") {
    return { ok: false, error: "ไม่มีสิทธิ์บันทึกวันลาของผู้อื่น" };
  }

  const fields = validateLeave(input);
  if (Object.keys(fields).length > 0) {
    return { ok: false, error: Object.values(fields)[0] ?? FAILED, fields };
  }

  const values = {
    leave_type: input.leaveType as LeaveType,
    start_date: input.startDate,
    end_date: input.endDate,
    note: normalizeNote(input.note),
  };
  const supabase = await createClient();
  const { data, error } = input.id
    ? await supabase.from("leaves").update(values).eq("id", input.id).eq("is_deleted", false).select("id")
    : await supabase
        .from("leaves")
        .insert({ ...values, owner_id: input.ownerId, created_by: profile.id })
        .select("id");

  if (error) return { ok: false, error: error.code === "P0001" ? error.message : FAILED };
  if (data.length !== 1) return { ok: false, error: "ไม่พบรายการวันลานี้ อาจถูกยกเลิกไปแล้ว" };
  refresh();
  return { ok: true };
}

/** Cancel = soft delete (no hard DELETE on any table). */
export async function cancelLeave(id: string): Promise<LeaveActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leaves")
    .update({ is_deleted: true })
    .eq("id", id)
    .eq("is_deleted", false)
    .select("id");
  if (error) return { ok: false, error: FAILED };
  if (data.length !== 1) return { ok: false, error: "ไม่พบรายการวันลานี้ อาจถูกยกเลิกไปแล้ว" };
  refresh();
  return { ok: true };
}
