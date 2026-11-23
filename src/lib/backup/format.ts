// BR-45/46 Backup file format (version 1) and validation shared by the page and the API.
// No passwords: Supabase stores only hashes and they cannot be exported.

export const BACKUP_FORMAT = "kanban-backup";
export const BACKUP_VERSION = 1;
export const BACKUP_MAX_BYTES = 20 * 1024 * 1024;

export const BACKUP_TABLES = ["profiles", "categories", "tasks", "task_history", "leaves", "holidays", "task_title_presets", "task_reviews"] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const BACKUP_TABLE_LABEL: Record<BackupTable, string> = {
  profiles: "ผู้ใช้",
  categories: "หมวดหมู่",
  tasks: "งาน",
  task_history: "ประวัติการย้ายงาน",
  leaves: "วันลา",
  holidays: "วันหยุด",
  task_title_presets: "หัวข้องาน",
  task_reviews: "คำขอตรวจงาน",
};

type Row = Record<string, unknown>;

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  created_at: string;
  data: Record<BackupTable, Row[]> & { app_settings: { fiscal_start_month: number } | null };
};

export type BackupCounts = Record<BackupTable, number>;

const isObj = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fields each row must carry for the restore to work.
const REQUIRED: Record<BackupTable, string[]> = {
  profiles: ["id", "username", "display_name"],
  categories: ["id", "name"],
  tasks: ["id", "owner_id", "title", "status", "category_id", "year"],
  task_history: ["task_id", "to_status", "changed_by", "changed_at"],
  leaves: ["id", "owner_id", "leave_type", "start_date", "end_date", "created_by"],
  holidays: ["holiday_date", "name"],
  task_title_presets: ["name"],
  task_reviews: ["id", "task_id", "owner_id", "reviewer_id", "requested_by"],
};
// Tables added after the first backups were made: missing means none.
const OPTIONAL_TABLES: readonly BackupTable[] = ["holidays", "task_title_presets", "task_reviews"];
const UUID_FIELDS = ["id", "owner_id", "category_id", "task_id", "changed_by", "created_by", "reviewer_id", "requested_by"];

export type BackupCheck = { ok: true; backup: BackupFile; counts: BackupCounts } | { ok: false; error: string };

export function checkBackup(raw: unknown): BackupCheck {
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: "ไฟล์นี้ไม่ใช่ไฟล์ backup ของระบบ" };
  }
  if (raw.version !== BACKUP_VERSION) {
    return { ok: false, error: `ไม่รองรับไฟล์ backup รุ่น ${String(raw.version)}` };
  }
  if (!isObj(raw.data)) return { ok: false, error: "ไฟล์ backup ไม่มีข้อมูล" };

  const counts = {} as BackupCounts;
  const data: Row = { ...raw.data };
  for (const table of BACKUP_TABLES) {
    if (data[table] === undefined && OPTIONAL_TABLES.includes(table)) data[table] = [];
    const rows = data[table];
    if (!Array.isArray(rows)) return { ok: false, error: `ไฟล์ backup ไม่มีข้อมูล${BACKUP_TABLE_LABEL[table]}` };
    for (const [i, row] of rows.entries()) {
      if (!isObj(row)) return { ok: false, error: `ข้อมูล${BACKUP_TABLE_LABEL[table]} แถวที่ ${i + 1} ไม่ถูกต้อง` };
      for (const field of REQUIRED[table]) {
        const value = row[field];
        if (value === undefined || value === null || value === "") {
          return { ok: false, error: `ข้อมูล${BACKUP_TABLE_LABEL[table]} แถวที่ ${i + 1} ไม่มี ${field}` };
        }
        if (UUID_FIELDS.includes(field) && !UUID.test(String(value))) {
          return { ok: false, error: `ข้อมูล${BACKUP_TABLE_LABEL[table]} แถวที่ ${i + 1} มี ${field} ไม่ถูกต้อง` };
        }
      }
    }
    counts[table] = rows.length;
  }
  const settings = data.app_settings;
  if (settings !== null && settings !== undefined && !isObj(settings)) {
    return { ok: false, error: "การตั้งค่าในไฟล์ backup ไม่ถูกต้อง" };
  }
  return { ok: true, backup: { ...raw, data } as unknown as BackupFile, counts };
}

/** e.g. kanban-backup-2569-11-22-1530.json (Buddhist Era, Bangkok time). */
export function backupFileName(now: Date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `kanban-backup-${Number(parts.year) + 543}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}.json`;
}

export type RestoreTableResult = { inserted: number; skipped: number; failed: number };
export type RestoreReport = Record<BackupTable, RestoreTableResult> & {
  settings: { current_fiscal_start_month: number | null; backup_fiscal_start_month: number | null; same: boolean };
  errors: string[];
  accountsCreated: number;
};
