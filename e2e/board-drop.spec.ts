// FR-08: dropping follows the pointer (middle columns included) and the target column glows.
import type { Locator, Page } from "@playwright/test";
import { expect, loginAs, test } from "./fixtures";
import { cardByTitle, column, unsavedCount } from "./support/board";
import { seedTasks } from "./support/tasks";

/** Start a drag, hover a point, report whether `glowing` glows, then drop. */
async function dragVia(page: Page, source: Locator, to: { x: number; y: number }, glowing: Locator) {
  const from = await source.boundingBox();
  if (!from) throw new Error("source not visible");
  const sx = from.x + from.width / 2;
  const sy = from.y + 12;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 4, sy + 8, { steps: 4 });
  await page.waitForTimeout(100);
  await page.mouse.move(to.x, to.y, { steps: 25 });
  await page.waitForTimeout(150);
  const glow = await glowing.getAttribute("data-drop-target");
  await page.mouse.up();
  await page.waitForTimeout(250);
  return glow === "true";
}

test("cards drop where the pointer is, between the middle columns too, and the target glows", async ({
  page,
  makeUser,
}) => {
  test.slow();
  const user = await makeUser();
  const now = new Date().toISOString();
  await seedTasks(user.id, [
    { title: "ระยะสั้น ก", status: "short_term" },
    { title: "ระยะสั้น ข", status: "short_term" },
    { title: "ทำอยู่ ก", status: "in_progress", startedAt: now },
    { title: "รอตรวจ ก", status: "review", startedAt: now },
  ]);
  await loginAs(page, user);
  const shortTerm = column(page, "short_term");
  const inProgress = column(page, "in_progress");

  // short_term -> in_progress, released on the column header (not on a card).
  const header = await inProgress.locator("header").boundingBox();
  const glowed = await dragVia(
    page,
    cardByTitle(page, "ระยะสั้น ก"),
    { x: header!.x + header!.width / 2, y: header!.y + 20 },
    inProgress,
  );
  expect(glowed).toBe(true);
  await expect(cardByTitle(inProgress, "ระยะสั้น ก")).toBeVisible();
  await expect(inProgress).not.toHaveAttribute("data-drop-target");

  // in_progress -> short_term, released just inside the column's left edge,
  // close to the neighbouring column (used to land in the wrong column).
  const shortBox = await shortTerm.boundingBox();
  const back = await dragVia(
    page,
    cardByTitle(page, "ทำอยู่ ก"),
    { x: shortBox!.x + 12, y: shortBox!.y + shortBox!.height - 20 },
    shortTerm,
  );
  expect(back).toBe(true);
  await expect(cardByTitle(shortTerm, "ทำอยู่ ก")).toBeVisible();

  // review -> in_progress over a card there.
  const target = await cardByTitle(inProgress, "ระยะสั้น ก").boundingBox();
  await dragVia(page, cardByTitle(page, "รอตรวจ ก"), { x: target!.x + target!.width / 2, y: target!.y + target!.height - 6 }, inProgress);
  await expect(cardByTitle(inProgress, "รอตรวจ ก")).toBeVisible();

  await expect(unsavedCount(page)).toHaveText("ยังไม่บันทึก 3 รายการ");
});
