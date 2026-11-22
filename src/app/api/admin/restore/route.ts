// BR-46: restore from a backup file. Only missing rows are inserted (duplicates are
// skipped, current data is never overwritten) and the result is reported per table.
import { NextResponse } from "next/server";
import {
  DEACTIVATED_BAN_DURATION,
  apiError,
  getDefaultPassword,
  requireAdminApi,
} from "@/lib/admin/api";
import { BACKUP_MAX_BYTES, checkBackup, type RestoreReport } from "@/lib/backup/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { toAuthEmail } from "@/lib/username";
import type { Json } from "@/types/database";

export async function POST(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const text = await request.text();
  if (text.length > BACKUP_MAX_BYTES) return apiError(413, "ไฟล์ backup ใหญ่เกินไป");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return apiError(400, "อ่านไฟล์ไม่ได้ ไฟล์ต้องเป็น JSON ที่ได้จากปุ่มดาวน์โหลด backup");
  }
  const check = checkBackup(raw);
  if (!check.ok) return apiError(400, check.error);
  const backup = check.backup;

  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id, username, display_name, is_active");
  if (readError) return apiError(500, "อ่านข้อมูลผู้ใช้ปัจจุบันไม่สำเร็จ");
  const existingIds = new Set(existing.map((p) => p.id));

  // People in the file but not in this system get an account with the default password
  // (BR-24 warning applies). Names must stay unique among active accounts (BR-20).
  const preErrors: string[] = [];
  const created: string[] = [];
  const keepProfiles = [];
  for (const p of backup.data.profiles) {
    const id = String(p.id);
    const name = String(p.display_name);
    if (existingIds.has(id)) {
      keepProfiles.push(p);
      continue;
    }
    const active = p.is_active !== false;
    if (active && existing.some((e) => e.is_active && e.display_name === name)) {
      preErrors.push(`ผู้ใช้ "${name}": มีบัญชีอื่นที่ใช้ชื่อนี้อยู่แล้ว จึงไม่ได้สร้างบัญชีให้`);
      continue;
    }
    const { data: authUser } = await supabase.auth.admin.getUserById(id);
    if (!authUser?.user) {
      const { error } = await supabase.auth.admin.createUser({
        id,
        email: toAuthEmail(String(p.username)), // BR-21
        password: getDefaultPassword(),
        email_confirm: true,
        ...(active ? {} : { ban_duration: DEACTIVATED_BAN_DURATION }),
      });
      if (error) {
        preErrors.push(`ผู้ใช้ "${name}": สร้างบัญชีไม่สำเร็จ (${error.message})`);
        continue;
      }
      created.push(id);
    }
    keepProfiles.push(p);
  }

  // Parsed from JSON text, so it is JSON-safe.
  const payload = { ...backup, data: { ...backup.data, profiles: keepProfiles } } as unknown as Json;
  const { data, error } = await supabase.rpc("admin_restore", { p_backup: payload });
  if (error || !data || typeof data !== "object") {
    // Nothing was written by the function (one transaction); undo the new accounts too.
    for (const id of created) await supabase.auth.admin.deleteUser(id);
    return apiError(500, "กู้คืนข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }

  // Do not leave accounts whose profile could not be inserted.
  const withProfile = new Set<string>();
  if (created.length > 0) {
    const { data: after } = await supabase.from("profiles").select("id").in("id", created);
    for (const p of after ?? []) withProfile.add(p.id);
  }
  for (const id of created) if (!withProfile.has(id)) await supabase.auth.admin.deleteUser(id);

  const report = data as Omit<RestoreReport, "accountsCreated">;
  const result: RestoreReport = {
    ...report,
    profiles: { ...report.profiles, failed: report.profiles.failed + preErrors.length },
    errors: [...preErrors, ...(report.errors ?? [])],
    accountsCreated: created.filter((id) => withProfile.has(id)).length,
  };
  return NextResponse.json(result);
}
