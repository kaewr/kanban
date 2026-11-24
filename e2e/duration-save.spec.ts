// Fix 24 Nov 2026 (BR-57): tasks added in another column and moved to "เสร็จแล้ว" before
// saving must save without minutes; a task entered straight in done without minutes
// (e.g. from an old draft) is named in the error instead of a generic failure.
import type { Page } from "@playwright/test";
import { expect, loginAs, test } from "./fixtures";
import { cardByTitle, column, unsavedCount } from "./support/board";
import { currentYear, firstCategory, tasksOf } from "./support/tasks";

async function addTask(page: Page, columnLabel: string, title: string, categoryId: string) {
  await page.getByRole("button", { name: `เพิ่มงานใน ${columnLabel}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่องาน").fill(title);
  await dialog.getByLabel("หมวดหมู่").selectOption(categoryId);
  await dialog.getByRole("button", { name: "เพิ่มงาน" }).click();
  await expect(dialog).toHaveCount(0);
}

test("several new tasks moved to done before saving are saved together", async ({ page, makeUser }) => {
  test.slow();
  const user = await makeUser();
  const category = await firstCategory();
  await loginAs(page, user);

  for (const title of ["งานหนึ่ง", "งานสอง", "งานสาม"]) {
    await addTask(page, "งานค้างระยะสั้น", title, category.id);
    await cardByTitle(page, title).getByRole("button", { name: `ตัวเลือกงาน ${title}` }).click();
    await page.getByRole("menuitem", { name: "เสร็จแล้ว" }).click();
  }
  await expect(column(page, "done").locator("li[data-task-id]")).toHaveCount(3);

  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(unsavedCount(page)).toHaveText("บันทึกแล้ว");
  const rows = await tasksOf(user.id);
  expect(rows.map((r) => r.status)).toEqual(["done", "done", "done"]);
  expect(rows.every((r) => r.duration_minutes === null)).toBe(true);
});

test("a draft from before BR-57 names the task that needs minutes, then saves once filled", async ({ page, makeUser }) => {
  test.slow();
  const user = await makeUser();
  const category = await firstCategory();
  const year = await currentYear();
  const now = new Date().toISOString();
  // A task created straight in done by the previous version: no durationMinutes field at all.
  const oldTask = {
    id: crypto.randomUUID(), ownerId: user.id, title: "งานจากร่างเก่า", description: null, status: "done",
    categoryId: category.id, priority: 2, year, dueDate: null, progress: null, position: 1024,
    carriedFromYear: null, startedAt: now, completedAt: now, version: 1, isDeleted: false, createdAt: now,
    isNew: true, moves: [{ from: null, to: "done", movedAt: now }],
  };
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [`kanban:draft:${user.id}:${year}`, JSON.stringify({ v: 1, savedAt: now, tasks: [oldTask] })] as const,
  );
  await loginAs(page, user);
  await page.getByRole("button", { name: "กู้คืน" }).click();

  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByTestId("save-error")).toContainText('กรุณากรอกเวลาที่ใช้ (นาที) ของงาน "งานจากร่างเก่า"');
  expect(await tasksOf(user.id)).toHaveLength(0); // nothing was sent

  await cardByTitle(page, "งานจากร่างเก่า").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/ใช้เวลา \(นาที\)/).fill("40");
  await dialog.getByRole("button", { name: "ตกลง" }).click();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(unsavedCount(page)).toHaveText("บันทึกแล้ว");
  expect((await tasksOf(user.id))[0]?.duration_minutes).toBe(40);
});
