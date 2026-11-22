// FR-04 (role), FR-06 (activate / deactivate), name, unit (BR-29), position (BR-30).
// BR-27: an admin cannot demote or deactivate themselves; the DB trigger also keeps
// at least one active admin.
import { NextResponse } from "next/server";
import {
  DEACTIVATED_BAN_DURATION,
  apiError,
  isUuid,
  readJsonObject,
  requireAdminApi,
} from "@/lib/admin/api";
import {
  isNameTaken,
  loadUnitIds,
  NAME_TAKEN,
  parseDisplayName,
  parsePosition,
  parseRole,
  parseUnitId,
  profileUpdateErrorMessage,
} from "@/lib/admin/users";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/users/[id]">) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) return apiError(404, "ไม่พบผู้ใช้");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "ข้อมูลไม่ถูกต้อง");

  const update: ProfileUpdate = {};
  if (body.displayName !== undefined) {
    const displayName = parseDisplayName(body.displayName);
    if (!displayName.ok) return apiError(400, displayName.error);
    update.display_name = displayName.value;
  }
  if (body.role !== undefined) {
    const role = parseRole(body.role);
    if (!role.ok) return apiError(400, role.error);
    update.role = role.value;
  }
  if (body.position !== undefined) {
    const position = parsePosition(body.position);
    if (!position.ok) return apiError(400, position.error);
    update.position = position.value;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return apiError(400, "ข้อมูลไม่ถูกต้อง");
    update.is_active = body.isActive;
  }
  if (Object.keys(update).length === 0) return apiError(400, "ไม่มีข้อมูลที่ต้องแก้ไข");

  if (id === admin.id && (update.role === "user" || update.is_active === false)) {
    return apiError(400, "ไม่สามารถลดสิทธิ์หรือปิดการใช้งานบัญชีของตัวเองได้"); // BR-27
  }

  const supabase = createAdminClient();
  if (update.display_name && (await isNameTaken(supabase, update.display_name, id))) {
    return apiError(409, NAME_TAKEN);
  }
  if (body.unitId !== undefined) {
    const unitId = parseUnitId(body.unitId, await loadUnitIds(supabase));
    if (!unitId.ok) return apiError(400, unitId.error);
    update.unit_id = unitId.value;
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!target) return apiError(404, "ไม่พบผู้ใช้");

  const { error } = await supabase.from("profiles").update(update).eq("id", id);
  if (error) return apiError(409, profileUpdateErrorMessage(error));

  // Mirror is_active in Supabase Auth so a deactivated account cannot sign in
  // or refresh its session at all (BR-26).
  if (update.is_active !== undefined && update.is_active !== target.is_active) {
    const { error: banError } = await supabase.auth.admin.updateUserById(id, {
      ban_duration: update.is_active ? "none" : DEACTIVATED_BAN_DURATION,
    });
    if (banError) {
      await supabase.from("profiles").update({ is_active: target.is_active }).eq("id", id);
      return apiError(500, "เปลี่ยนสถานะบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  }

  return NextResponse.json({ ok: true });
}
