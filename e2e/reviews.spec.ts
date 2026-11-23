// BR-53..56: tag a reviewer in "รอตรวจสอบ", in-app notifications, reviewer decisions.
import type { Page } from "@playwright/test";
import { expect, gotoReady, loginAs, test } from "./fixtures";
import { cardByTitle, unsavedCount } from "./support/board";
import { seedTasks } from "./support/tasks";
import { service, type TestUser } from "./support/users";

/** Owner sends a task to review through the card menu and picks the reviewer. */
async function sendToReview(page: Page, title: string, reviewer: TestUser | null) {
  await cardByTitle(page, title).getByRole("button", { name: `ตัวเลือกงาน ${title}` }).click();
  await page.getByRole("menuitem", { name: "รอตรวจสอบ" }).click();
  const picker = page.getByRole("dialog", { name: "ส่งให้ใครตรวจ?" });
  await expect(picker).toBeVisible();
  if (reviewer) {
    await picker.getByLabel("ผู้ตรวจ").selectOption({ label: reviewer.displayName });
    await picker.getByRole("button", { name: "เลือกผู้ตรวจ" }).click();
  } else {
    await picker.getByRole("button", { name: "ข้าม" }).click();
  }
  await expect(picker).toHaveCount(0);
}

async function save(page: Page) {
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(unsavedCount(page)).toHaveText("บันทึกแล้ว");
}

async function taskRow(ownerId: string, title: string) {
  const { data } = await service().from("tasks").select("status, reviewer_id").eq("owner_id", ownerId).eq("title", title).single();
  return data;
}

test.describe("review tags", () => {
  test("owner tags a reviewer; reviewer is notified and sends it back; owner is notified", async ({ browser, makeUser }) => {
    test.slow();
    const owner = await makeUser();
    const reviewer = await makeUser();
    const now = new Date().toISOString();
    await seedTasks(owner.id, [{ title: "สรุปผลการประชุม", status: "in_progress", startedAt: now }]);

    const ownerPage = await browser.newPage();
    await loginAs(ownerPage, owner);
    await sendToReview(ownerPage, "สรุปผลการประชุม", reviewer);
    const card = cardByTitle(ownerPage, "สรุปผลการประชุม");
    await expect(card.getByTestId("task-reviewer")).toHaveText(`รอ ${reviewer.displayName} ตรวจ`);
    // Nothing is sent before saving (FR-09).
    const { data: before } = await service().from("task_reviews").select("id").eq("owner_id", owner.id);
    expect(before).toHaveLength(0);
    await save(ownerPage);
    expect(await taskRow(owner.id, "สรุปผลการประชุม")).toEqual({ status: "review", reviewer_id: reviewer.id });

    const reviewerPage = await browser.newPage();
    await loginAs(reviewerPage, reviewer);
    await expect(reviewerPage.getByTestId("notification-count")).toHaveText("1");
    await reviewerPage.getByTestId("notification-bell").click();
    await expect(reviewerPage.getByTestId("notification-item").first()).toContainText(
      `${owner.displayName} ขอให้คุณตรวจงาน`,
    );
    await reviewerPage.getByTestId("notification-item").first().click();
    await expect(reviewerPage).toHaveURL(/\/reviews$/);
    await expect(reviewerPage.getByTestId("notification-count")).toHaveCount(0);

    const item = reviewerPage.locator('li[data-review-title="สรุปผลการประชุม"]');
    await expect(item).toContainText(owner.displayName);
    await item.getByLabel(/ความเห็น/).fill("ขอแก้ตารางหน้า 3");
    await item.getByRole("button", { name: "ส่งกลับแก้" }).click();
    await expect(item).toHaveCount(0);
    await expect(reviewerPage.getByTestId("review-done")).toContainText("ส่งกลับแก้");
    expect(await taskRow(owner.id, "สรุปผลการประชุม")).toEqual({ status: "in_progress", reviewer_id: null });

    await ownerPage.reload();
    await expect(ownerPage.getByTestId("notification-count")).toHaveText("1");
    await ownerPage.getByTestId("notification-bell").click();
    const note = ownerPage.getByTestId("notification-item").first();
    await expect(note).toContainText(`${reviewer.displayName} ส่งงานกลับให้แก้`);
    await expect(note).toContainText("ขอแก้ตารางหน้า 3");
    await ownerPage.keyboard.press("Escape");
    await expect(ownerPage.locator('section[data-status="in_progress"]')).toContainText("สรุปผลการประชุม");

    await ownerPage.close();
    await reviewerPage.close();
  });

  test("reviewer comments first (owner sees it on the card), then approves", async ({ browser, makeUser }) => {
    test.slow();
    const owner = await makeUser();
    const reviewer = await makeUser();
    await seedTasks(owner.id, [{ title: "รายงานไตรมาส", status: "in_progress", startedAt: new Date().toISOString() }]);

    const ownerPage = await browser.newPage();
    await loginAs(ownerPage, owner);
    await sendToReview(ownerPage, "รายงานไตรมาส", reviewer);
    await save(ownerPage);

    const reviewerPage = await browser.newPage();
    await loginAs(reviewerPage, reviewer);
    await gotoReady(reviewerPage, "/reviews");
    const item = reviewerPage.locator('li[data-review-title="รายงานไตรมาส"]');
    // Comment needs text.
    await item.getByRole("button", { name: "ให้ความเห็น" }).click();
    await expect(item.getByText("กรุณาเขียนความเห็น")).toBeVisible();
    await item.getByLabel(/ความเห็น/).fill("ตัวเลขหน้า 2 ยังไม่ตรง");
    await item.getByRole("button", { name: "ให้ความเห็น" }).click();
    await expect(item).toContainText("ความเห็นก่อนหน้าของคุณ: ตัวเลขหน้า 2 ยังไม่ตรง");
    expect((await taskRow(owner.id, "รายงานไตรมาส"))?.status).toBe("review");

    await ownerPage.reload();
    await expect(cardByTitle(ownerPage, "รายงานไตรมาส").getByTestId("task-review-comment")).toContainText(
      "ตัวเลขหน้า 2 ยังไม่ตรง",
    );

    await item.getByRole("button", { name: "ผ่าน" }).click();
    await expect(item).toHaveCount(0);
    expect((await taskRow(owner.id, "รายงานไตรมาส"))?.status).toBe("done");
    await ownerPage.reload();
    await expect(ownerPage.locator('section[data-status="done"]')).toContainText("รายงานไตรมาส");
    await ownerPage.getByTestId("notification-bell").click();
    await expect(ownerPage.getByTestId("notification-item").first()).toContainText(`${reviewer.displayName} ตรวจผ่านงานของคุณ`);

    await ownerPage.close();
    await reviewerPage.close();
  });

  test("skipping the picker leaves no reviewer; it can be set later in the dialog; moving out withdraws", async ({
    browser,
    makeUser,
  }) => {
    test.slow();
    const owner = await makeUser();
    const reviewer = await makeUser();
    await seedTasks(owner.id, [{ title: "ประสานงานวิทยากร", status: "in_progress", startedAt: new Date().toISOString() }]);

    const page = await browser.newPage();
    await loginAs(page, owner);
    await sendToReview(page, "ประสานงานวิทยากร", null);
    const card = cardByTitle(page, "ประสานงานวิทยากร");
    await expect(card.getByTestId("task-reviewer")).toHaveText("ยังไม่ระบุผู้ตรวจ");

    await card.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("ผู้ตรวจ")).not.toContainText(owner.displayName); // never yourself
    await dialog.getByLabel("ผู้ตรวจ").selectOption({ label: reviewer.displayName });
    await dialog.getByRole("button", { name: "ตกลง" }).click();
    await expect(card.getByTestId("task-reviewer")).toHaveText(`รอ ${reviewer.displayName} ตรวจ`);
    await save(page);

    // Owner moves it back: the request is withdrawn and the reviewer is told.
    await card.getByRole("button", { name: "ตัวเลือกงาน ประสานงานวิทยากร" }).click();
    await page.getByRole("menuitem", { name: "กำลังทำ" }).click();
    await save(page);
    const { data: reviews } = await service().from("task_reviews").select("status").eq("owner_id", owner.id);
    expect(reviews).toEqual([{ status: "withdrawn" }]);
    const { data: notes } = await service().from("notifications").select("kind").eq("user_id", reviewer.id).order("id");
    expect(notes?.map((n) => n.kind)).toEqual(["review_requested", "review_withdrawn"]);
    await page.close();
  });
});
