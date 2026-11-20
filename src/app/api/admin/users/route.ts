// FR-04: admin creates a user with a role. Password = DEFAULT_PASSWORD (BR-23),
// must_change_password = true (BR-24 -> warning banner).
import { NextResponse } from "next/server";
import { apiError, getDefaultPassword, readJsonObject, requireAdminApi } from "@/lib/admin/api";
import { parseDisplayName, parseRole, parseUsername } from "@/lib/admin/users";
import { createAdminClient } from "@/lib/supabase/admin";
import { toAuthEmail } from "@/lib/username";

const USERNAME_TAKEN = "ชื่อผู้ใช้นี้มีอยู่แล้ว";

export async function POST(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "ข้อมูลไม่ถูกต้อง");

  const username = parseUsername(body.username);
  if (!username.ok) return apiError(400, username.error);
  const displayName = parseDisplayName(body.displayName);
  if (!displayName.ok) return apiError(400, displayName.error);
  const role = parseRole(body.role);
  if (!role.ok) return apiError(400, role.error);

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.value)
    .maybeSingle();
  if (existing) return apiError(409, USERNAME_TAKEN);

  const created = await supabase.auth.admin.createUser({
    email: toAuthEmail(username.value), // BR-21
    password: getDefaultPassword(),
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    const code = created.error?.code;
    if (code === "email_exists" || code === "user_already_exists") {
      return apiError(409, USERNAME_TAKEN);
    }
    return apiError(500, "สร้างผู้ใช้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }

  const userId = created.data.user.id;
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    username: username.value,
    display_name: displayName.value,
    role: role.value,
    must_change_password: true,
    is_active: true,
  });

  if (profileError) {
    // Do not leave an auth account without a profile.
    await supabase.auth.admin.deleteUser(userId);
    if (profileError.code === "23505") return apiError(409, USERNAME_TAKEN);
    return apiError(500, "สร้างผู้ใช้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }

  return NextResponse.json({ id: userId }, { status: 201 });
}
