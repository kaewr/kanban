// FR-05 / BR-25: reset to DEFAULT_PASSWORD and set must_change_password (BR-24 warning).
import { NextResponse } from "next/server";
import { apiError, getDefaultPassword, isUuid, requireAdminApi } from "@/lib/admin/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: RouteContext<"/api/admin/users/[id]/reset-password">) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;

  const { id } = await params;
  if (!isUuid(id)) return apiError(404, "ไม่พบผู้ใช้");
  if (id === admin.id) {
    return apiError(400, "รีเซ็ตรหัสผ่านของตัวเองไม่ได้ กรุณาเปลี่ยนรหัสผ่านที่หน้าโปรไฟล์");
  }

  const supabase = createAdminClient();
  const { data: target } = await supabase.from("profiles").select("id").eq("id", id).maybeSingle();
  if (!target) return apiError(404, "ไม่พบผู้ใช้");

  const { error: authError } = await supabase.auth.admin.updateUserById(id, {
    password: getDefaultPassword(),
  });
  if (authError) return apiError(500, "รีเซ็ตรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");

  const { error } = await supabase.from("profiles").update({ must_change_password: true }).eq("id", id);
  if (error) {
    return apiError(500, "รีเซ็ตรหัสผ่านแล้ว แต่บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }

  return NextResponse.json({ ok: true });
}
