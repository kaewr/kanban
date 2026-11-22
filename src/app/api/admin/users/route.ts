// FR-04: admin creates a user with a unit (BR-29), position (BR-30) and role.
// The username is generated (people log in by picking their name, BR-20). Password = DEFAULT_PASSWORD (BR-23),
// must_change_password = true (BR-24 -> warning banner).
import { NextResponse } from "next/server";
import { apiError, getDefaultPassword, readJsonObject, requireAdminApi } from "@/lib/admin/api";
import {
  isNameTaken,
  loadUnitIds,
  NAME_TAKEN,
  parseDisplayName,
  parsePosition,
  parseRole,
  parseUnitId,
} from "@/lib/admin/users";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUsername, toAuthEmail } from "@/lib/username";

const CREATE_FAILED = "สร้างผู้ใช้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

export async function POST(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "ข้อมูลไม่ถูกต้อง");

  const displayName = parseDisplayName(body.displayName);
  if (!displayName.ok) return apiError(400, displayName.error);
  const role = parseRole(body.role);
  if (!role.ok) return apiError(400, role.error);
  const position = parsePosition(body.position);
  if (!position.ok) return apiError(400, position.error);

  const supabase = createAdminClient();
  const unitId = parseUnitId(body.unitId, await loadUnitIds(supabase));
  if (!unitId.ok) return apiError(400, unitId.error);

  if (await isNameTaken(supabase, displayName.value)) return apiError(409, NAME_TAKEN);

  const username = generateUsername();
  const created = await supabase.auth.admin.createUser({
    email: toAuthEmail(username), // BR-21
    password: getDefaultPassword(),
    email_confirm: true,
  });
  if (created.error || !created.data.user) return apiError(500, CREATE_FAILED);

  const userId = created.data.user.id;
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    username,
    display_name: displayName.value,
    unit_id: unitId.value,
    position: position.value,
    role: role.value,
    must_change_password: true,
    is_active: true,
  });

  if (profileError) {
    // Do not leave an auth account without a profile.
    await supabase.auth.admin.deleteUser(userId);
    return apiError(500, CREATE_FAILED);
  }

  return NextResponse.json({ id: userId }, { status: 201 });
}
