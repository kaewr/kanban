// BR-45: admin downloads everyone's work and the settings as one JSON file.
import { apiError, requireAdminApi } from "@/lib/admin/api";
import { BACKUP_FORMAT, BACKUP_VERSION, backupFileName } from "@/lib/backup/format";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  const supabase = createAdminClient();
  // Soft-deleted tasks and leaves are included so history and the dashboard stay complete.
  const [profiles, categories, tasks, history, leaves, settings] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, role, unit_id, position, year_type, is_active, created_at")
      .order("created_at"),
    supabase.from("categories").select("id, name, sort_order, is_active").order("sort_order"),
    supabase.from("tasks").select("*").order("created_at"),
    supabase
      .from("task_history")
      .select("task_id, from_status, to_status, changed_by, changed_at")
      .order("changed_at")
      .order("id"),
    supabase.from("leaves").select("*").order("start_date"),
    supabase.from("app_settings").select("fiscal_start_month").maybeSingle(),
  ]);
  const failed = [profiles, categories, tasks, history, leaves, settings].find((r) => r.error);
  if (failed) return apiError(500, "สร้างไฟล์ backup ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");

  const now = new Date();
  const body = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    created_at: now.toISOString(),
    data: {
      profiles: profiles.data,
      categories: categories.data,
      tasks: tasks.data,
      task_history: history.data,
      leaves: leaves.data,
      app_settings: settings.data,
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFileName(now)}"`,
      "Cache-Control": "no-store",
    },
  });
}
