// Long columns: each column scrolls inside the screen; "เสร็จแล้ว" shows the 10 latest.
import { expect, loginAs, test } from "./fixtures";
import { cardByTitle, column, mouseDrag, unsavedCount } from "./support/board";
import { seedTasks } from "./support/tasks";

const iso = (day: number) => `2026-10-${String(day).padStart(2, "0")}T03:00:00.000Z`;

test.describe("long columns", () => {
  test("columns scroll inside the screen and the done column shows the latest 10", async ({ page, makeUser }) => {
    test.slow();
    const user = await makeUser();
    await seedTasks(user.id, [
      ...Array.from({ length: 15 }, (_, i) => ({
        title: `เสร็จ ${String(i + 1).padStart(2, "0")}`,
        status: "done" as const,
        startedAt: iso(1),
        completedAt: iso(i + 2), // เสร็จ 15 is the latest
      })),
      ...Array.from({ length: 14 }, (_, i) => ({ title: `ค้าง ${String(i + 1).padStart(2, "0")}`, status: "short_term" as const })),
    ]);
    await loginAs(page, user);

    // The page itself does not grow with the cards; the short-term list scrolls.
    const list = column(page, "short_term").locator("ol");
    await expect.poll(() => list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(pageHeight).toBeLessThan(80);
    await expect(page.getByRole("button", { name: "เพิ่มงานใน งานค้างระยะสั้น" })).toBeInViewport();

    // Done: 10 latest, oldest five hidden until expanded.
    const done = column(page, "done");
    await expect(done.getByTestId("task-title")).toHaveCount(10);
    await expect(done.getByLabel("แสดง 10 จาก 15 งาน")).toBeVisible();
    await expect(cardByTitle(done, "เสร็จ 15")).toBeAttached();
    await expect(cardByTitle(done, "เสร็จ 01")).toHaveCount(0);

    await done.getByRole("button", { name: "แสดงทั้งหมด (15)" }).click();
    await expect(done.getByTestId("task-title")).toHaveCount(15);
    await done.getByRole("button", { name: "แสดงเฉพาะงานล่าสุด" }).click();
    await expect(done.getByTestId("task-title")).toHaveCount(10);

    // A filter shows every match, including older finished tasks.
    await page.getByLabel("ค้นหางาน").fill("เสร็จ 01");
    await expect(cardByTitle(done, "เสร็จ 01")).toBeVisible();
    await page.getByLabel("ค้นหางาน").fill("");

    // Dragging into the long done column still works; the moved card stays visible.
    await mouseDrag(page, cardByTitle(page, "ค้าง 01"), done);
    await expect(cardByTitle(done, "ค้าง 01")).toBeAttached();
    await expect(unsavedCount(page)).toHaveText("ยังไม่บันทึก 1 รายการ");
  });
});
