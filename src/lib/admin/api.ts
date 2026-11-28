import "server-only";
import { NextResponse } from "next/server";
import { getCurrentProfile, type CurrentProfile } from "@/lib/auth";

export type ApiErrorBody = { error: string };

export function apiError(status: number, message: string): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Every /api/admin route starts with this (CLAUDE.md security rule).
 * The profile read goes through RLS, so an inactive account gets no row -> 401.
 */
export async function requireAdminApi(): Promise<
  { admin: CurrentProfile; response?: never } | { admin?: never; response: NextResponse<ApiErrorBody> }
> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { response: apiError(401, "กรุณาเข้าสู่ระบบใหม่") };
  }
  if (profile.role !== "admin") {
    return { response: apiError(403, "ไม่มีสิทธิ์ดำเนินการ") };
  }
  if (profile.mustChangePassword) {
    return { response: apiError(403, "กรุณาเปลี่ยนรหัสผ่านเริ่มต้นก่อนใช้งานส่วนผู้ดูแลระบบ") }; // BR-59
  }
  return { admin: profile };
}

/** Parses a JSON object body; returns null for anything else. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Server-only default password (BR-23). */
export function getDefaultPassword(): string {
  const value = process.env.DEFAULT_PASSWORD;
  if (!value) throw new Error("Missing DEFAULT_PASSWORD");
  return value;
}

/** Long ban used to block Supabase Auth sign-in for deactivated accounts (BR-26). */
export const DEACTIVATED_BAN_DURATION = "876000h"; // ~100 years
