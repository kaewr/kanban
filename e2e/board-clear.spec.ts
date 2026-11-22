// BR-47 clear own board (selected year, soft delete, typed confirmation) and the
// "มี N งานด้านบน" indicator on sticky column headers.
import { expect, gotoReady, loginAs, test } from "./fixtures";
import { cardByTitle, column } from "./support/board";
import { currentYear, seedTasks, tasksOf } from "./support/tasks";

test.describe("clear own board", () => {
  test("clears this year's tasks after a typed confirmation; other years stay", async ({ page, makeUser }) => {
    test.slow();
    const user = await makeUser();
    const year = await currentYear();
    await seedTasks(user.id, [
      { title: "ทดลอง 1", status: "short_term" },
      { title: "ทดลอง 2", status: "done", startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
      { title: "งานปีก่อน", status: "short_term", year: year - 1 },
    ]);
    await loginAs(page, user);

    // Unsaved work is discarded too.
    await page.getByRole("button", { name: "เพิ่มงานใน งานค้างระยะสั้น" }).click();
    await page.getByRole("dialog").getByLabel("ชื่องาน").fill("ยังไม่บันทึก");
    await page.getByRole("dialog").getByLabel("หมวดหมู่").selectOption({ index: 1 });
    await page.getByRole("dialog").getByRole("button", { name: "เพิ่มงาน" }).click();

    await page.getByRole("button", { name: "ตัวเลือกบอร์ด" }).click();
    await page.getByRole("menuitem", { name: "ล้างงานทั้งหมดของปีนี้" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("alert")).toContainText("งานที่บันทึกไว้ 2 รายการ");
    await expect(dialog.getByRole("alert")).toContainText("งานใหม่ที่ยังไม่บันทึก 1 รายการ");
    await expect(dialog.getByRole("alert")).toContainText("กู้คืนเองไม่ได้");

    const confirm = dialog.getByRole("button", { name: "ล้างงานทั้งหมด" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/เพื่อยืนยัน/).fill("ล้าง");
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/เพื่อยืนยัน/).fill("ล้างงาน");
    await confirm.click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("clear-result")).toHaveText("ล้างงานแล้ว 2 รายการ");
    await expect(page.getByTestId("task-title")).toHaveCount(0);
    await expect(page.getByTestId("unsaved-count")).toHaveText("ไม่มีรายการที่ยังไม่บันทึก");

    const rows = await tasksOf(user.id);
    expect(rows.filter((t) => t.year === year).every((t) => t.is_deleted && t.version === 2)).toBe(true);
    expect(rows.find((t) => t.title === "งานปีก่อน")).toMatchObject({ is_deleted: false });

    // Nothing comes back after a reload (no draft left behind).
    await page.reload();
    await expect(page.getByTestId("task-title")).toHaveCount(0);
    await expect(page.getByText("พบร่างที่ยังไม่บันทึก")).toHaveCount(0);
  });

  test("admins cannot clear someone else's board", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();
    await seedTasks(user.id, [{ title: "ของพนักงาน", status: "short_term" }]);
    await loginAs(page, admin);
    await expect(page.getByRole("button", { name: "ตัวเลือกบอร์ด" })).toBeVisible(); // own board
    await gotoReady(page, `/board?user=${user.username}`);
    await expect(cardByTitle(page, "ของพนักงาน")).toBeVisible();
    await expect(page.getByRole("button", { name: "ตัวเลือกบอร์ด" })).toHaveCount(0);
  });
});

test("a short column shows how many cards are above when the page is scrolled", async ({ page, makeUser }) => {
  const user = await makeUser();
  await seedTasks(user.id, [
    ...Array.from({ length: 10 }, (_, i) => ({ title: `ยาว ${String(i + 1).padStart(2, "0")}`, status: "short_term" as const })),
    { title: "งานเดียว", status: "in_progress", startedAt: new Date().toISOString() },
  ]);
  await page.setViewportSize({ width: 1280, height: 720 });
  await loginAs(page, user);

  const inProgress = column(page, "in_progress");
  await expect(inProgress.getByTestId("cards-above")).toHaveCount(0);

  await cardByTitle(page, "ยาว 10").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 400);
  const indicator = inProgress.getByTestId("cards-above");
  await expect(indicator).toHaveText("มี 1 งานด้านบน");

  await indicator.click();
  await expect(cardByTitle(inProgress, "งานเดียว")).toBeInViewport();
  await expect(indicator).toHaveCount(0);
});
