// M8: FR-13 due highlights, FR-14 search and filters on the board.
import { expect, loginAs, test } from "./fixtures";
import { cardByTitle, column, unsavedCount } from "./support/board";
import { categoryByName, seedTasks } from "./support/tasks";

const day = 86_400_000;
const bangkok = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(Date.now() + offsetDays * day));

test.describe("FR-13 due highlights", () => {
  test("overdue is red, due within 3 days is orange, later or finished is not highlighted", async ({ page, makeUser }) => {
    const user = await makeUser();
    const now = new Date().toISOString();
    await seedTasks(user.id, [
      { title: "เลยกำหนด", status: "in_progress", startedAt: now, dueDate: bangkok(-2) },
      { title: "ครบวันนี้", status: "short_term", dueDate: bangkok(0) },
      { title: "อีกสามวัน", status: "short_term", dueDate: bangkok(3) },
      { title: "อีกสี่วัน", status: "short_term", dueDate: bangkok(4) },
      { title: "เสร็จแล้วแม้เลยกำหนด", status: "done", startedAt: now, completedAt: now, dueDate: bangkok(-5) },
    ]);
    await loginAs(page, user);

    const state = (title: string) => cardByTitle(page, title).getByTestId("task-due-state");
    await expect(state("เลยกำหนด")).toHaveAttribute("data-kind", "overdue");
    await expect(state("เลยกำหนด")).toHaveText("เกินกำหนด 2 วัน");
    await expect(state("ครบวันนี้")).toHaveAttribute("data-kind", "soon");
    await expect(state("ครบวันนี้")).toHaveText("ครบกำหนดวันนี้");
    await expect(state("อีกสามวัน")).toHaveText("อีก 3 วันครบกำหนด");
    await expect(state("อีกสี่วัน")).toHaveCount(0);
    await expect(state("เสร็จแล้วแม้เลยกำหนด")).toHaveCount(0);
  });
});

test.describe("FR-14 search and filters", () => {
  test("search, category, priority and due filters narrow the board; clearing restores it", async ({
    page,
    makeUser,
  }) => {
    test.slow();
    const user = await makeUser();
    const routine = await categoryByName("งานประจำ");
    const self = await categoryByName("พัฒนาตนเอง");
    const now = new Date().toISOString();
    await seedTasks(user.id, [
      { title: "ปรับปรุงเว็บไซต์คณะ", status: "in_progress", startedAt: now, priority: 1, categoryId: routine.id, dueDate: bangkok(-1) },
      { title: "อบรม Excel", status: "short_term", priority: 3, categoryId: self.id, description: "หลักสูตรออนไลน์ เว็บ ก.พ." },
      { title: "ประชุมกรรมการ", status: "short_term", priority: 2, categoryId: routine.id, dueDate: bangkok(2) },
      { title: "สรุปผลงานปี", status: "done", startedAt: now, completedAt: now, priority: 1, categoryId: routine.id },
    ]);
    await loginAs(page, user);
    const search = page.getByLabel("ค้นหางาน");
    const count = page.getByTestId("filter-count");
    await expect(count).toHaveCount(0);

    // Search matches title and description.
    await search.fill("เว็บ");
    await expect(count).toHaveText("แสดง 2 จาก 4 งาน");
    await expect(cardByTitle(page, "ปรับปรุงเว็บไซต์คณะ")).toBeVisible();
    await expect(cardByTitle(page, "อบรม Excel")).toBeVisible();
    await expect(cardByTitle(page, "ประชุมกรรมการ")).toHaveCount(0);
    await expect(column(page, "short_term").getByLabel("แสดง 1 จาก 2 งาน")).toBeVisible();

    await search.fill("");
    await page.getByLabel("กรองตามหมวดหมู่").selectOption(routine.id);
    await page.getByLabel("กรองตามความสำคัญ").selectOption("1");
    await expect(count).toHaveText("แสดง 2 จาก 4 งาน");
    await expect(cardByTitle(page, "สรุปผลงานปี")).toBeVisible();

    await page.getByLabel("กรองตามวันกำหนดเสร็จ").selectOption("overdue");
    await expect(count).toHaveText("แสดง 1 จาก 4 งาน");
    await expect(cardByTitle(page, "ปรับปรุงเว็บไซต์คณะ")).toBeVisible();

    await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
    await expect(count).toHaveCount(0);
    for (const title of ["ปรับปรุงเว็บไซต์คณะ", "อบรม Excel", "ประชุมกรรมการ", "สรุปผลงานปี"]) {
      await expect(cardByTitle(page, title)).toBeVisible();
    }

    // Filtering never counts as an unsaved change and is gone after a reload.
    await page.getByLabel("กรองตามวันกำหนดเสร็จ").selectOption("soon");
    await expect(cardByTitle(page, "ประชุมกรรมการ")).toBeVisible();
    await expect(unsavedCount(page)).toHaveText("ไม่มีรายการที่ยังไม่บันทึก");
    await page.reload();
    await expect(page.getByLabel("กรองตามวันกำหนดเสร็จ")).toHaveValue("all");
  });
});
