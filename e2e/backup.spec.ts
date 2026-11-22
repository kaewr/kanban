// BR-45/46 backup and restore. Tests upload a backup trimmed to their own users so
// parallel tests are not disturbed.
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, gotoReady, loginAs, test } from "./fixtures";
import { seedHistory, seedTasks } from "./support/tasks";
import { defaultPassword, deleteTestUser, service } from "./support/users";

type Row = Record<string, unknown>;
type Backup = {
  format: string;
  version: number;
  created_at: string;
  data: {
    profiles: Row[];
    categories: Row[];
    tasks: Row[];
    task_history: Row[];
    leaves: Row[];
    app_settings: { fiscal_start_month: number } | null;
  };
};

async function download(request: APIRequestContext): Promise<Backup> {
  const res = await request.get("/api/admin/backup");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="kanban-backup-25\d\d-/);
  return (await res.json()) as Backup;
}

/** Keep only the given owners' rows (categories and settings stay). */
function trim(backup: Backup, ownerIds: string[]): Backup {
  const owners = new Set(ownerIds);
  const tasks = backup.data.tasks.filter((t) => owners.has(String(t.owner_id)));
  const taskIds = new Set(tasks.map((t) => String(t.id)));
  return {
    ...backup,
    data: {
      ...backup.data,
      profiles: backup.data.profiles.filter((p) => owners.has(String(p.id))),
      tasks,
      task_history: backup.data.task_history.filter((h) => taskIds.has(String(h.task_id))),
      leaves: backup.data.leaves.filter((l) => owners.has(String(l.owner_id))),
    },
  };
}

async function restore(page: Page, backup: Backup) {
  await gotoReady(page, "/admin/backup");
  await page.getByLabel("เลือกไฟล์ backup (.json)").setInputFiles({
    name: "kanban-backup-test.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByTestId("restore-preview")).toBeVisible();
  await page.getByRole("button", { name: "ยืนยันกู้คืนข้อมูล" }).click();
  await expect(page.getByTestId("restore-report")).toBeVisible();
}

const cell = (page: Page, table: string, col: "inserted" | "skipped" | "failed") =>
  page.getByTestId("restore-report").locator(`tr[data-table="${table}"] td[data-col="${col}"]`);

test.describe("backup and restore", () => {
  test("restore puts back lost work, skips duplicates and reports per table", async ({ page, makeUser }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();
    const [kept, lost] = await seedTasks(user.id, [
      { title: "งานที่ยังอยู่", status: "short_term" },
      { title: "งานที่หายไป", status: "in_progress", startedAt: new Date().toISOString() },
    ]);
    await seedHistory([{ taskId: lost.id, from: "short_term", to: "in_progress", by: user.id, at: new Date().toISOString() }]);
    await service().from("leaves").insert({
      owner_id: user.id, created_by: user.id, leave_type: "sick", start_date: "2026-12-07", end_date: "2026-12-08",
    });

    await loginAs(page, admin);
    await gotoReady(page, "/admin");
    await page.getByRole("link", { name: /สำรองและกู้คืนข้อมูล/ }).click();
    await expect(page.getByRole("link", { name: "ดาวน์โหลด backup" })).toBeVisible();

    const backup = trim(await download(page.request), [user.id]);
    expect(backup.data.tasks.map((t) => t.title).sort()).toEqual(["งานที่ยังอยู่", "งานที่หายไป"]);
    expect(backup.data.profiles[0]).not.toHaveProperty("password");

    // Lose one task (with its history) and the leave.
    await service().from("task_history").delete().eq("task_id", lost.id);
    await service().from("tasks").delete().eq("id", lost.id);
    await service().from("leaves").delete().eq("owner_id", user.id);

    await restore(page, backup);
    await expect(cell(page, "tasks", "inserted")).toHaveText("1");
    await expect(cell(page, "tasks", "skipped")).toHaveText("1");
    await expect(cell(page, "task_history", "inserted")).toHaveText("1");
    await expect(cell(page, "leaves", "inserted")).toHaveText("1");
    await expect(cell(page, "profiles", "skipped")).toHaveText("1");
    await expect(page.getByTestId("restore-settings")).toContainText("ตรงกับไฟล์");

    const { data: tasks } = await service().from("tasks").select("id, title").eq("owner_id", user.id);
    expect(tasks?.map((t) => t.id).sort()).toEqual([kept.id, lost.id].sort());

    // Restoring the same file again inserts nothing.
    await restore(page, backup);
    for (const table of ["profiles", "categories", "tasks", "task_history", "leaves"]) {
      await expect(cell(page, table, "inserted")).toHaveText("0");
      await expect(cell(page, table, "failed")).toHaveText("0");
    }
  });

  test("a person missing from the system gets an account with the default password", async ({ page, makeUser }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();
    await seedTasks(user.id, [{ title: "งานของคนที่ถูกลบ", status: "short_term" }]);
    await loginAs(page, admin);
    const backup = trim(await download(page.request), [user.id]);

    await deleteTestUser(user.id); // account, profile and tasks gone
    await restore(page, backup);
    await expect(cell(page, "profiles", "inserted")).toHaveText("1");
    await expect(cell(page, "tasks", "inserted")).toHaveText("1");
    await expect(page.getByTestId("restore-report")).toContainText("สร้างบัญชีใหม่ 1 บัญชี");

    const { data: profile } = await service().from("profiles").select("display_name, must_change_password").eq("id", user.id).single();
    expect(profile).toEqual({ display_name: user.displayName, must_change_password: true });

    const userPage = await (await page.context().browser()!.newContext()).newPage();
    await loginAs(userPage, { displayName: user.displayName, password: defaultPassword() });
    await expect(userPage.getByText("งานของคนที่ถูกลบ")).toBeVisible();
  });

  test("an overlapping leave and settings that differ are reported, not written", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();
    await service().from("leaves").insert({
      owner_id: user.id, created_by: user.id, leave_type: "sick", start_date: "2026-12-14", end_date: "2026-12-15",
    });
    await loginAs(page, admin);
    const backup = trim(await download(page.request), [user.id]);
    // Same dates, different id -> overlap; settings in the file differ from the current ones.
    backup.data.leaves = backup.data.leaves.map((l) => ({ ...l, id: crypto.randomUUID() }));
    const current = backup.data.app_settings?.fiscal_start_month ?? 10;
    backup.data.app_settings = { fiscal_start_month: current === 1 ? 2 : 1 };

    await restore(page, backup);
    await expect(cell(page, "leaves", "failed")).toHaveText("1");
    await expect(page.getByTestId("restore-errors")).toContainText("ซ้อน");
    await expect(page.getByTestId("restore-settings")).toContainText("ไม่ได้เขียนทับ");
    const { data } = await service().from("app_settings").select("fiscal_start_month").single();
    expect(data?.fiscal_start_month).toBe(current);
  });

  test("bad files are rejected and non-admins cannot use the API", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();
    await loginAs(page, admin);
    await gotoReady(page, "/admin/backup");
    await page.getByLabel("เลือกไฟล์ backup (.json)").setInputFiles({
      name: "other.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ hello: "world" })),
    });
    await expect(page.getByText("ไฟล์นี้ไม่ใช่ไฟล์ backup ของระบบ")).toBeVisible();
    await expect(page.getByTestId("restore-preview")).toHaveCount(0);

    const userPage = await (await page.context().browser()!.newContext()).newPage();
    await loginAs(userPage, user);
    expect((await userPage.request.get("/api/admin/backup")).status()).toBe(403);
    expect((await userPage.request.post("/api/admin/restore", { data: {} })).status()).toBe(403);
    await userPage.goto("/admin/backup");
    await expect(userPage).toHaveURL(/\/board$/);
  });
});
