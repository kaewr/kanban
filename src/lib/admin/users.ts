// Validation shared by the admin user API routes (FR-04..06).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { USER_ROLES, type UserRole } from "@/types/domain";

export const DISPLAY_NAME_MAX = 100;
export const POSITION_MAX = 100;

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseDisplayName(raw: unknown): Validated<string> {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0 || name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `กรุณากรอกชื่อ-นามสกุล (ไม่เกิน ${DISPLAY_NAME_MAX} ตัวอักษร)` };
  }
  return { ok: true, value: name };
}

/** BR-30: optional free text typed by an admin; blank means no position. */
export function parsePosition(raw: unknown): Validated<string | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "ตำแหน่งไม่ถูกต้อง" };
  const position = raw.trim().replace(/\s+/g, " ");
  if (position.length > POSITION_MAX) {
    return { ok: false, error: `ตำแหน่งยาวได้ไม่เกิน ${POSITION_MAX} ตัวอักษร` };
  }
  return { ok: true, value: position.length > 0 ? position : null };
}

/** BR-29: one of the fixed units. `allowed` comes from the units table. */
export function parseUnitId(raw: unknown, allowed: readonly string[]): Validated<string> {
  if (typeof raw === "string" && allowed.includes(raw)) return { ok: true, value: raw };
  return { ok: false, error: "กรุณาเลือกสังกัดงาน" };
}

export function parseRole(raw: unknown): Validated<UserRole> {
  if (typeof raw === "string" && (USER_ROLES as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as UserRole };
  }
  return { ok: false, error: "บทบาทไม่ถูกต้อง" };
}

/** The BR-27 trigger raises P0001 with a Thai message; anything else is generic. */
export function profileUpdateErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "P0001") return error.message;
  return "บันทึกข้อมูลผู้ใช้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export async function loadUnitIds(supabase: SupabaseClient<Database>): Promise<string[]> {
  const { data, error } = await supabase.from("units").select("id");
  if (error) throw new Error(`load units: ${error.message}`);
  return data.map((u) => u.id);
}

export const NAME_TAKEN = "มีผู้ใช้ชื่อนี้อยู่แล้ว";

/** Names are picked from a list at login (BR-20), so active people need distinct names. */
export async function isNameTaken(
  supabase: SupabaseClient<Database>,
  displayName: string,
  exceptId?: string,
): Promise<boolean> {
  let query = supabase.from("profiles").select("id").eq("display_name", displayName).eq("is_active", true);
  if (exceptId) query = query.neq("id", exceptId);
  const { data, error } = await query.limit(1);
  if (error) throw new Error(`check name: ${error.message}`);
  return data.length > 0;
}
