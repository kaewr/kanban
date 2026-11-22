// M7: FR-11 / BR-28 admin views and edits another user's board, FR-20 / BR-06 moving out of review.
import type { Page } from "@playwright/test";
import { expect, gotoReady, loginAs, test } from "./fixtures";
import { cardByTitle, column, unsavedCount } from "./support/board";
import { currentYear, firstCategory, historyOf, seedTasks, tasksOf } from "./support/tasks";
import { setActive, signedInClient } from "./support/users";

const banner = (page: Page) => page.getByTestId("foreign-board-banner");
const ownerSelect = (page: Page) => page.getByLabel("เลือกบอร์ดของผู้ใช้");

async function moveWithMenu(page: Page, title: string, to: string) {
  await page.getByRole("button", { name: `ตัวเลือกงาน ${title}` }).click();
  await page.getByRole("menuitem", { name: to }).click();
}

test.describe("FR-11 admin edits another user's board", () => {
  test("switches to the user's board, edits, saves as admin (FR-20 rework from review)", async ({
    page,
    makeUser,
  }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();
    const category = await firstCategory();
    const [inReview] = await seedTasks(user.id, [
      { title: "รอตรวจของผู้ใช้", status: "review", startedAt: "2026-11-01T00:00:00Z" },
    ]);
    await seedTasks(admin.id, [{ title: "งานของแอดมิน", status: "short_term" }]);

    await loginAs(page, admin);
    await expect(banner(page)).toHaveCount(0);
    await expect(cardByTitle(page, "งานของแอดมิน")).toBeVisible();

    await ownerSelect(page).selectOption(user.id);
    await expect(page).toHaveURL(new RegExp(`/board\\?user=${user.username}&year=\\d+$`));
    await expect(banner(page)).toContainText(user.displayName);
    await expect(banner(page)).toContainText("งานวิชาการ");
    await expect(cardByTitle(column(page, "review"), "รอตรวจของผู้ใช้")).toBeVisible();
    await expect(cardByTitle(page, "งานของแอดมิน")).toHaveCount(0);

    // FR-20 / BR-05: admin sends it back from review.
    await moveWithMenu(page, "รอตรวจของผู้ใช้", "กำลังทำ");
    await page.getByRole("button", { name: "เพิ่มงานใน งานค้างระยะสั้น" }).click();
    await page.getByRole("dialog").getByLabel("ชื่องาน").fill("งานที่แอดมินเพิ่มให้");
    await page.getByRole("dialog").getByLabel("หมวดหมู่").selectOption(category.id);
    await page.getByRole("dialog").getByRole("button", { name: "เพิ่มงาน" }).click();
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(unsavedCount(page)).toHaveText("บันทึกแล้ว");

    const rows = await tasksOf(user.id);
    expect(rows.find((r) => r.id === inReview.id)).toMatchObject({ status: "in_progress", version: 2 });
    const created = rows.find((r) => r.title === "งานที่แอดมินเพิ่มให้");
    expect(created).toMatchObject({ owner_id: user.id }); // belongs to the board owner
    expect(await historyOf(inReview.id)).toEqual([
      expect.objectContaining({ from_status: "review", to_status: "in_progress", changed_by: admin.id }),
    ]);
    expect(await historyOf(created!.id)).toEqual([expect.objectContaining({ changed_by: admin.id })]);
    expect(await tasksOf(admin.id)).toHaveLength(1);

    // FR-12 year switch keeps the selected owner.
    const year = await currentYear();
    await page.getByLabel("เลือกปี").selectOption(String(year - 1));
    await expect(page).toHaveURL(new RegExp(`/board\\?user=${user.username}&year=${year - 1}$`));
    await expect(banner(page)).toBeVisible();

    // Back to own board.
    await page.getByRole("link", { name: "กลับไปบอร์ดของฉัน" }).click();
    await expect(page).toHaveURL(new RegExp(`/board\\?year=${year - 1}$`));
    await expect(banner(page)).toHaveCount(0);
  });

  test("FR-10 asks before switching boards with unsaved changes", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();
    await seedTasks(admin.id, [{ title: "ยังไม่บันทึก", status: "short_term" }]);
    await loginAs(page, admin);

    await moveWithMenu(page, "ยังไม่บันทึก", "กำลังทำ");
    await ownerSelect(page).selectOption(user.id);
    const dialog = page.getByRole("dialog", { name: "ยังไม่ได้บันทึก" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "อยู่ต่อ" }).click();
    await expect(page).toHaveURL(/\/board$/);
    await expect(ownerSelect(page)).toHaveValue(admin.id);

    await ownerSelect(page).selectOption(user.id);
    await dialog.getByRole("button", { name: "ออกโดยไม่บันทึก" }).click();
    await expect(page).toHaveURL(new RegExp(`user=${user.username}`));
    await expect(banner(page)).toBeVisible();
  });

  test("inactive users are listed and their boards can still be opened", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();
    await seedTasks(user.id, [{ title: "งานค้างของคนที่ปิดบัญชี", status: "short_term" }]);
    await setActive(user.id, false);

    await loginAs(page, admin);
    await expect(ownerSelect(page).locator(`option[value="${user.id}"]`)).toContainText("ปิดใช้งาน");
    await gotoReady(page, `/board?user=${user.username}`);
    await expect(banner(page)).toContainText("บัญชีนี้ปิดใช้งานแล้ว");
    await expect(cardByTitle(page, "งานค้างของคนที่ปิดบัญชี")).toBeVisible();
  });
});

test.describe("normal users stay on their own board", () => {
  test("?user= is ignored and there is no owner picker", async ({ page, makeUser }) => {
    const user = await makeUser();
    const other = await makeUser();
    await seedTasks(user.id, [{ title: "ของฉัน", status: "short_term" }]);
    await seedTasks(other.id, [{ title: "ของคนอื่น", status: "short_term" }]);

    await loginAs(page, user);
    await gotoReady(page, `/board?user=${other.username}`);
    await expect(cardByTitle(page, "ของฉัน")).toBeVisible();
    await expect(cardByTitle(page, "ของคนอื่น")).toHaveCount(0);
    await expect(banner(page)).toHaveCount(0);
    await expect(ownerSelect(page)).toHaveCount(0);
  });

  test("BR-06: another user cannot move a task out of review, even through the API", async ({ makeUser }) => {
    const owner = await makeUser();
    const other = await makeUser();
    const [task] = await seedTasks(owner.id, [
      { title: "รอตรวจ", status: "review", startedAt: "2026-11-01T00:00:00Z" },
    ]);
    const client = await signedInClient(other);
    const res = await client.rpc("save_board_changes", {
      p_changes: {
        tasks: [
          {
            op: "update",
            id: task.id,
            version: task.version,
            title: task.title,
            description: null,
            status: "in_progress",
            category_id: task.category_id,
            priority: task.priority,
            year: task.year,
            due_date: null,
            progress: null,
            position: task.position,
            carried_from_year: null,
            started_at: task.started_at,
            completed_at: null,
            moves: [{ from: "review", to: "in_progress", moved_at: new Date().toISOString() }],
          },
        ],
      },
    });
    // RLS hides the row: either an error or a conflict, never a write.
    expect(res.error !== null || (res.data as { ok?: boolean } | null)?.ok === false).toBe(true);
    expect((await tasksOf(owner.id))[0]).toMatchObject({ status: "review", version: task.version });
  });
});
