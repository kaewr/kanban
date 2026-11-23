// M6: FR-09 (save, transaction, conflicts), FR-10 (leave warnings, drafts), FR-11 history attribution
import type { Page } from "@playwright/test";
import { expect, gotoReady, loginAs, logout, test } from "./fixtures";
import { card, cardByTitle, column, unsavedCount } from "./support/board";
import { editElsewhere, firstCategory, historyOf, seedTasks, tasksOf } from "./support/tasks";
import { signedInClient } from "./support/users";
import type { Json } from "../src/types/database";

async function moveWithMenu(page: Page, title: string, to: string) {
  await page.getByRole("button", { name: `ตัวเลือกงาน ${title}` }).click();
  await page.getByRole("menuitem", { name: to }).click();
  // BR-53: moving into review asks for a reviewer; these tests skip it.
  if (to === "รอตรวจสอบ") await page.getByRole("dialog", { name: "ส่งให้ใครตรวจ?" }).getByRole("button", { name: "ข้าม" }).click();
}

async function save(page: Page) {
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(unsavedCount(page)).toHaveText("บันทึกแล้ว");
}

/** Accept the browser's beforeunload prompt and remember that it was shown. */
function acceptBeforeUnload(page: Page): { shown: () => boolean } {
  let shown = false;
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "beforeunload") shown = true;
    await dialog.accept();
  });
  return { shown: () => shown };
}

test.describe("FR-09 save", () => {
  test("saves create, edit, move and delete in one go and writes history with moved_at", async ({ page, makeUser }) => {
    test.slow();
    const user = await makeUser();
    const category = await firstCategory();
    const [moving, editing, removing] = await seedTasks(user.id, [
      { title: "จะย้าย", status: "short_term" },
      { title: "จะแก้", status: "long_term" },
      { title: "จะลบ", status: "review", startedAt: "2026-11-01T00:00:00Z" },
    ]);
    await loginAs(page, user);

    const beforeMove = Date.now();
    await moveWithMenu(page, "จะย้าย", "กำลังทำ");
    const afterMove = Date.now();

    await card(page, editing.id).click();
    await page.getByRole("dialog").getByLabel("ชื่องาน").fill("แก้แล้ว");
    await page.getByRole("dialog").getByRole("button", { name: "ตกลง" }).click();

    await page.getByRole("button", { name: "ตัวเลือกงาน จะลบ" }).click();
    await page.getByRole("menuitem", { name: "ลบงาน" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ลบงาน" }).click();

    await page.getByRole("button", { name: "เพิ่มงานใน งานค้างระยะสั้น" }).click();
    await page.getByRole("dialog").getByLabel("ชื่องาน").fill("งานใหม่");
    await page.getByRole("dialog").getByLabel("หมวดหมู่").selectOption(category.id);
    await page.getByRole("dialog").getByRole("button", { name: "เพิ่มงาน" }).click();

    await expect(unsavedCount(page)).toHaveText("ยังไม่บันทึก 4 รายการ");
    await page.waitForTimeout(1500); // the save happens clearly later than the move
    await save(page);
    await expect(card(page, moving.id).getByTestId("task-unsaved")).toHaveCount(0);

    const rows = await tasksOf(user.id);
    const byTitle = (t: string) => rows.find((r) => r.title === t);
    expect(byTitle("จะย้าย")).toMatchObject({ status: "in_progress", version: 2 });
    expect(byTitle("จะย้าย")?.started_at).not.toBeNull(); // BR-03
    expect(byTitle("แก้แล้ว")).toMatchObject({ version: 2 });
    expect(rows.find((r) => r.id === removing.id)).toMatchObject({ is_deleted: true, version: 2 }); // BR-12
    expect(byTitle("งานใหม่")).toMatchObject({ status: "short_term", version: 1, owner_id: user.id });

    const moveHistory = await historyOf(moving.id);
    expect(moveHistory).toHaveLength(1);
    expect(moveHistory[0]).toMatchObject({ from_status: "short_term", to_status: "in_progress", changed_by: user.id });
    const changedAt = Date.parse(moveHistory[0].changed_at);
    expect(changedAt).toBeGreaterThanOrEqual(beforeMove - 1000); // moved_at, not the save time
    expect(changedAt).toBeLessThanOrEqual(afterMove + 1000);

    const createdHistory = await historyOf(byTitle("งานใหม่")!.id);
    expect(createdHistory).toEqual([expect.objectContaining({ from_status: null, to_status: "short_term" })]);
    expect(await historyOf(editing.id)).toHaveLength(0); // no column change, no history

    // Persisted: reload shows the saved board with nothing pending.
    await gotoReady(page, "/board");
    await expect(cardByTitle(column(page, "in_progress"), "จะย้าย")).toBeVisible();
    await expect(cardByTitle(page, "จะลบ")).toHaveCount(0);
    await expect(unsavedCount(page)).toHaveText("ไม่มีรายการที่ยังไม่บันทึก");
  });

  test("BR-04 is enforced when saving moves into and out of done", async ({ page, makeUser }) => {
    const user = await makeUser();
    const [task] = await seedTasks(user.id, [{ title: "ปิดงาน", status: "review", startedAt: "2026-11-01T00:00:00Z" }]);
    await loginAs(page, user);

    await moveWithMenu(page, "ปิดงาน", "เสร็จแล้ว");
    await save(page);
    expect((await tasksOf(user.id))[0].completed_at).not.toBeNull();

    await moveWithMenu(page, "ปิดงาน", "รอตรวจสอบ");
    await save(page);
    const [row] = await tasksOf(user.id);
    expect(row).toMatchObject({ status: "review", completed_at: null, version: 3 });
    expect((await historyOf(task.id)).map((h) => h.to_status)).toEqual(["done", "review"]);
  });

  test("conflict: nothing is saved, the conflicting task is listed and can be reloaded", async ({ page, makeUser }) => {
    test.slow();
    const user = await makeUser();
    const [shared, other] = await seedTasks(user.id, [
      { title: "งานที่ชน", status: "short_term" },
      { title: "งานอื่น", status: "short_term" },
    ]);
    await loginAs(page, user);

    await card(page, shared.id).click();
    await page.getByRole("dialog").getByLabel("ชื่องาน").fill("ชื่อจากเครื่องนี้");
    await page.getByRole("dialog").getByRole("button", { name: "ตกลง" }).click();
    await moveWithMenu(page, "งานอื่น", "กำลังทำ");

    await editElsewhere(shared.id, "ชื่อจากที่อื่น");

    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("conflict-list")).toHaveText("ชื่อจากที่อื่น");

    // Transaction: the non-conflicting change was not written either.
    const rows = await tasksOf(user.id);
    expect(rows.find((r) => r.id === other.id)).toMatchObject({ status: "short_term", version: 1 });
    expect(await historyOf(other.id)).toHaveLength(0);

    await dialog.getByRole("button", { name: "โหลดงานที่ชนใหม่" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card(page, shared.id)).toContainText("ชื่อจากที่อื่น");
    await expect(cardByTitle(column(page, "in_progress"), "งานอื่น")).toBeVisible(); // kept
    await expect(unsavedCount(page)).toHaveText("ยังไม่บันทึก 1 รายการ");

    await save(page);
    expect((await tasksOf(user.id)).find((r) => r.id === other.id)).toMatchObject({ status: "in_progress", version: 2 });
  });
});

test.describe("FR-10 leave warnings and drafts", () => {
  test("closing/reloading warns; reopening offers the draft (restore and discard)", async ({ page, makeUser }) => {
    test.slow();
    const user = await makeUser();
    const [task] = await seedTasks(user.id, [{ title: "ร่างงาน", status: "short_term" }]);
    await loginAs(page, user);
    const prompt = acceptBeforeUnload(page);

    await moveWithMenu(page, "ร่างงาน", "รอตรวจสอบ");
    await page.waitForTimeout(800); // draft write is debounced
    await page.reload();
    expect(prompt.shown()).toBe(true);

    const draftDialog = page.getByRole("dialog", { name: "พบร่างที่ยังไม่บันทึก" });
    await expect(draftDialog).toBeVisible();
    await draftDialog.getByRole("button", { name: "กู้คืน" }).click();
    await expect(cardByTitle(column(page, "review"), "ร่างงาน")).toBeVisible();
    await expect(unsavedCount(page)).toHaveText("ยังไม่บันทึก 1 รายการ");

    await page.waitForTimeout(800);
    await page.reload();
    await page.getByRole("dialog", { name: "พบร่างที่ยังไม่บันทึก" }).getByRole("button", { name: "ทิ้งร่าง" }).click();
    await expect(cardByTitle(column(page, "short_term"), "ร่างงาน")).toBeVisible();
    await expect(unsavedCount(page)).toHaveText("ไม่มีรายการที่ยังไม่บันทึก");

    await page.reload();
    await expect(card(page, task.id)).toBeVisible();
    await expect(page.getByRole("dialog", { name: "พบร่างที่ยังไม่บันทึก" })).toHaveCount(0);
  });

  test("in-app navigation and year change ask first", async ({ page, makeUser }) => {
    const user = await makeUser();
    await seedTasks(user.id, [{ title: "อย่าเพิ่งไป", status: "short_term" }]);
    await loginAs(page, user);
    await moveWithMenu(page, "อย่าเพิ่งไป", "กำลังทำ");

    const nav = page.getByRole("navigation");
    await nav.getByRole("link", { name: "Dashboard" }).click();
    const leave = page.getByRole("dialog", { name: "ยังไม่ได้บันทึก" });
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "อยู่ต่อ" }).click();
    await expect(page).toHaveURL(/\/board$/);

    const year = await page.getByLabel("เลือกปี").inputValue();
    await page.getByLabel("เลือกปี").selectOption(String(Number(year) - 1));
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "อยู่ต่อ" }).click();
    await expect(page).toHaveURL(/\/board$/);
    await expect(page.getByLabel("เลือกปี")).toHaveValue(year);

    await nav.getByRole("link", { name: "Dashboard" }).click();
    await leave.getByRole("button", { name: "ออกโดยไม่บันทึก" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("no warning when everything is saved", async ({ page, makeUser }) => {
    const user = await makeUser();
    await seedTasks(user.id, [{ title: "บันทึกแล้ว", status: "short_term" }]);
    await loginAs(page, user);
    await moveWithMenu(page, "บันทึกแล้ว", "กำลังทำ");
    await save(page);

    await page.getByRole("navigation").getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("logout removes drafts from the browser", async ({ page, makeUser }) => {
    const user = await makeUser();
    await seedTasks(user.id, [{ title: "ร่างลับ", status: "short_term" }]);
    await loginAs(page, user);
    await moveWithMenu(page, "ร่างลับ", "กำลังทำ");
    await page.waitForTimeout(800);

    await page.getByRole("link", { name: user.displayName }).click();
    await page.getByRole("dialog", { name: "ยังไม่ได้บันทึก" }).getByRole("button", { name: "ออกโดยไม่บันทึก" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("kanban:draft:")))).toBe(true);

    await logout(page);
    expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("kanban:draft:")))).toBe(false);

    await loginAs(page, user);
    await expect(page.getByRole("dialog", { name: "พบร่างที่ยังไม่บันทึก" })).toHaveCount(0);
  });
});

test.describe("save_board_changes security (RLS)", () => {
  test("another user cannot save someone else's tasks; an admin can and is recorded in history", async ({ makeUser }) => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const admin = await makeUser({ role: "admin" });
    const category = await firstCategory();
    const [task] = await seedTasks(owner.id, [{ title: "ของเจ้าของ", status: "short_term" }]);

    const update = (title: string, status: string) =>
      ({
        tasks: [
          {
            op: "update",
            id: task.id,
            version: task.version,
            owner_id: owner.id,
            title,
            description: null,
            status,
            category_id: category.id,
            priority: 2,
            year: task.year,
            due_date: null,
            progress: null,
            position: 1024,
            started_at: null,
            completed_at: null,
            moves: [{ from: "short_term", to: status, moved_at: new Date().toISOString() }],
          },
        ],
      }) as unknown as Json;

    // Stranger: the row is invisible under RLS -> reported as a conflict, nothing written.
    const strangerClient = await signedInClient(stranger);
    const denied = await strangerClient.rpc("save_board_changes", { p_changes: update("ยึด", "done") });
    expect(denied.data).toMatchObject({ ok: false });
    const created = await strangerClient.rpc("save_board_changes", {
      p_changes: {
        tasks: [
          {
            op: "create",
            id: crypto.randomUUID(),
            version: 1,
            owner_id: owner.id,
            title: "ปลอม",
            description: null,
            status: "short_term",
            category_id: category.id,
            priority: 2,
            year: task.year,
            due_date: null,
            progress: null,
            position: 1,
            started_at: null,
            completed_at: null,
            moves: [],
          },
        ],
      } as unknown as Json,
    });
    expect(created.error).not.toBeNull(); // RLS with check rejects the insert
    expect(await tasksOf(owner.id)).toEqual([expect.objectContaining({ title: "ของเจ้าของ", version: 1 })]);

    // Admin: allowed, history records the admin (FR-11).
    const adminClient = await signedInClient(admin);
    const allowed = await adminClient.rpc("save_board_changes", { p_changes: update("แก้โดยแอดมิน", "in_progress") });
    expect(allowed.error).toBeNull();
    expect(allowed.data).toMatchObject({ ok: true });
    expect((await tasksOf(owner.id))[0]).toMatchObject({ title: "แก้โดยแอดมิน", status: "in_progress", version: 2 });
    expect(await historyOf(task.id)).toEqual([
      expect.objectContaining({ from_status: "short_term", to_status: "in_progress", changed_by: admin.id }),
    ]);
  });
});
