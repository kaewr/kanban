// M5 on a phone (Pixel 7, touch): one column per screen, long-press drag, menu fallback (FR-08).
import { expect, loginAs, test } from "./fixtures";
import { card, cardByTitle, column, titlesIn, touchDrag } from "./support/board";
import { seedTasks } from "./support/tasks";

test("shows one column per screen and scrolls sideways to the others", async ({ page, makeUser }) => {
  const user = await makeUser();
  await loginAs(page, user);

  await expect(column(page, "long_term")).toBeInViewport({ ratio: 0.9 });
  await expect(column(page, "in_progress")).not.toBeInViewport();

  await column(page, "in_progress").scrollIntoViewIfNeeded();
  await expect(column(page, "in_progress")).toBeInViewport({ ratio: 0.9 });

  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(pageOverflow).toBeLessThanOrEqual(0); // only the board scrolls, not the page
});

test("long-press drag reorders cards with touch", async ({ page, makeUser }) => {
  test.slow();
  const user = await makeUser();
  const [, second] = await seedTasks(user.id, [
    { title: "แรก", status: "long_term" },
    { title: "ที่สอง", status: "long_term" },
  ]);
  await loginAs(page, user);
  await expect.poll(() => titlesIn(page, "long_term")).toEqual(["แรก", "ที่สอง"]);

  await touchDrag(page, card(page, second.id), cardByTitle(page, "แรก"), "top");
  await expect.poll(() => titlesIn(page, "long_term")).toEqual(["ที่สอง", "แรก"]);
});

test("card menu moves a task to another column with taps", async ({ page, makeUser }) => {
  const user = await makeUser();
  await seedTasks(user.id, [{ title: "ย้ายบนมือถือ", status: "long_term" }]);
  await loginAs(page, user);

  await page.getByRole("button", { name: "ตัวเลือกงาน ย้ายบนมือถือ" }).tap();
  await page.getByRole("menuitem", { name: "กำลังทำ" }).tap();
  await column(page, "in_progress").scrollIntoViewIfNeeded();
  await expect(cardByTitle(column(page, "in_progress"), "ย้ายบนมือถือ")).toBeVisible();
});
