// Long columns: each column sizes to its cards and scrolls on its own (max = screen),
// "+ เพิ่มงาน" on top, 10 cards per column with "แสดงเพิ่มอีก 10" until all are shown.
import type { Page } from "@playwright/test";
import { expect, loginAs, test } from "./fixtures";
import { cardByTitle, column, mouseDrag, unsavedCount } from "./support/board";
import { seedTasks } from "./support/tasks";

const iso = (day: number) => `2026-10-${String(day).padStart(2, "0")}T03:00:00.000Z`;
const pad = (n: number) => String(n).padStart(2, "0");

async function moveWithMenu(page: Page, title: string, to: string) {
  await page.getByRole("button", { name: `ตัวเลือกงาน ${title}` }).click();
  await page.getByRole("menuitem", { name: to }).click();
}

test.describe("long columns", () => {
  test("columns show 10 cards, load 10 more at a time, and scroll on their own", async ({ page, makeUser }) => {
    test.slow();
    const user = await makeUser();
    await seedTasks(user.id, [
      ...Array.from({ length: 15 }, (_, i) => ({
        title: `เสร็จ ${pad(i + 1)}`,
        status: "done" as const,
        startedAt: iso(1),
        completedAt: iso(i + 2), // เสร็จ 15 finished last
      })),
      ...Array.from({ length: 24 }, (_, i) => ({ title: `ค้าง ${pad(i + 1)}`, status: "short_term" as const })),
    ]);
    await loginAs(page, user);

    const shortTerm = column(page, "short_term");
    const titles = shortTerm.getByTestId("task-title");

    // "+ เพิ่มงาน" sits above the cards.
    const add = page.getByRole("button", { name: "เพิ่มงานใน งานค้างระยะสั้น" });
    const addBox = await add.boundingBox();
    const firstBox = await cardByTitle(shortTerm, "ค้าง 01").boundingBox();
    expect(addBox!.y).toBeLessThan(firstBox!.y);

    // First 10 by position, then 10 more, then the rest; collapse goes back to 10.
    await expect(titles).toHaveCount(10);
    await expect(shortTerm.getByLabel("แสดง 10 จาก 24 งาน")).toBeVisible();
    await expect(cardByTitle(shortTerm, "ค้าง 11")).toHaveCount(0);
    await shortTerm.getByRole("button", { name: "แสดงเพิ่มอีก 10 (เหลือ 14)" }).click();
    await expect(titles).toHaveCount(20);
    await shortTerm.getByRole("button", { name: "แสดงเพิ่มอีก 4 (เหลือ 4)" }).click();
    await expect(titles).toHaveCount(24);
    await expect(shortTerm.getByTestId("column-more")).toHaveCount(0);

    // The long column scrolls inside itself; the page does not grow and the header stays put.
    const area = shortTerm.getByTestId("column-drop");
    expect(await area.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    const pageOverflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(pageOverflow).toBeLessThan(80);
    await cardByTitle(shortTerm, "ค้าง 24").scrollIntoViewIfNeeded();
    await expect(add).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(80);

    // Columns are as tall as their cards: the empty review column is much shorter.
    const reviewBox = await column(page, "review").boundingBox();
    const shortBox = await shortTerm.boundingBox();
    expect(reviewBox!.height).toBeLessThan(shortBox!.height / 2);

    await shortTerm.getByRole("button", { name: "ย่อกลับ" }).click();
    await expect(titles).toHaveCount(10);

    // Done: the 10 most recently finished.
    const done = column(page, "done");
    await expect(done.getByTestId("task-title")).toHaveCount(10);
    await expect(cardByTitle(done, "เสร็จ 15")).toBeAttached();
    await expect(cardByTitle(done, "เสร็จ 01")).toHaveCount(0);

    // A filter shows every match, hidden ones included.
    await page.getByLabel("ค้นหางาน").fill("ค้าง 2");
    await expect(titles).toHaveCount(5); // ค้าง 20..24
    await page.getByLabel("ค้นหางาน").fill("");
    await expect(titles).toHaveCount(10);

    // Moving into "เสร็จแล้ว" makes the card the latest finished one: still 10 shown,
    // the oldest of those drops out.
    await moveWithMenu(page, "ค้าง 01", "เสร็จแล้ว");
    await expect(cardByTitle(done, "ค้าง 01")).toBeVisible();
    await expect(done.getByTestId("task-title")).toHaveCount(10);
    await expect(cardByTitle(done, "เสร็จ 06")).toHaveCount(0);
    // Dragging onto a long column works too.
    await mouseDrag(page, cardByTitle(page, "ค้าง 02"), done);
    await expect(cardByTitle(done, "ค้าง 02")).toBeAttached();
    await expect(unsavedCount(page)).toHaveText("ยังไม่บันทึก 2 รายการ");
  });
});
