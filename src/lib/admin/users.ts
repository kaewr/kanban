// Validation shared by the admin user API routes (FR-04..06).
import { isValidUsername, normalizeUsername } from "@/lib/username";
import { USER_ROLES, type UserRole } from "@/types/domain";

export const DISPLAY_NAME_MAX = 100;

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseUsername(raw: unknown): Validated<string> {
  const username = normalizeUsername(raw);
  if (!isValidUsername(username)) {
    return {
      ok: false,
      error: "ชื่อผู้ใช้ต้องเป็น a-z 0-9 . _ ยาว 3–30 ตัวอักษร", // BR-22
    };
  }
  return { ok: true, value: username };
}

export function parseDisplayName(raw: unknown): Validated<string> {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0 || name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `กรุณากรอกชื่อที่แสดง (ไม่เกิน ${DISPLAY_NAME_MAX} ตัวอักษร)` };
  }
  return { ok: true, value: name };
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
