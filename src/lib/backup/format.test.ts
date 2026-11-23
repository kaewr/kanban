import { describe, expect, it } from "vitest";
import { backupFileName, checkBackup } from "./format";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const valid = {
  format: "kanban-backup",
  version: 1,
  created_at: "2026-11-22T08:00:00Z",
  data: {
    profiles: [{ id: id(1), username: "u_1", display_name: "ก" }],
    categories: [{ id: id(2), name: "งานประจำ" }],
    tasks: [{ id: id(3), owner_id: id(1), title: "งาน", status: "done", category_id: id(2), year: 2570 }],
    task_history: [{ task_id: id(3), to_status: "done", changed_by: id(1), changed_at: "2026-11-22T08:00:00Z" }],
    leaves: [{ id: id(4), owner_id: id(1), leave_type: "sick", start_date: "2026-11-23", end_date: "2026-11-23", created_by: id(1) }],
    app_settings: { fiscal_start_month: 10 },
  },
};

describe("checkBackup", () => {
  it("accepts a valid file and counts rows", () => {
    const result = checkBackup(valid);
    expect(result).toMatchObject({ ok: true, counts: { profiles: 1, categories: 1, tasks: 1, task_history: 1, leaves: 1 } });
  });

  it("accepts older files made before holidays existed", () => {
    const result = checkBackup(valid);
    expect(result).toMatchObject({ ok: true, counts: { holidays: 0, task_title_presets: 0 } });
    if (result.ok) expect(result.backup.data.holidays).toEqual([]);
    const withHoliday = { ...valid, data: { ...valid.data, holidays: [{ holiday_date: "2026-12-05", name: "วันพ่อ" }] } };
    expect(checkBackup(withHoliday)).toMatchObject({ ok: true, counts: { holidays: 1 } });
    const badHoliday = { ...valid, data: { ...valid.data, holidays: [{ holiday_date: "2026-12-05", name: "" }] } };
    expect(checkBackup(badHoliday).ok).toBe(false);
  });

  it("rejects other files, other versions and broken rows", () => {
    expect(checkBackup({ hello: 1 })).toEqual({ ok: false, error: "ไฟล์นี้ไม่ใช่ไฟล์ backup ของระบบ" });
    expect(checkBackup({ ...valid, version: 2 }).ok).toBe(false);
    expect(checkBackup({ ...valid, data: { ...valid.data, tasks: "x" } }).ok).toBe(false);
    const badId = { ...valid, data: { ...valid.data, leaves: [{ ...valid.data.leaves[0], owner_id: "nope" }] } };
    expect(checkBackup(badId)).toMatchObject({ ok: false, error: expect.stringContaining("owner_id") });
    const missing = { ...valid, data: { ...valid.data, tasks: [{ ...valid.data.tasks[0], title: "" }] } };
    expect(checkBackup(missing)).toMatchObject({ ok: false, error: expect.stringContaining("title") });
  });
});

describe("backupFileName", () => {
  it("uses the Buddhist Era and Bangkok time", () => {
    expect(backupFileName(new Date("2026-11-22T08:30:00Z"))).toBe("kanban-backup-2569-11-22-1530.json");
  });
});
