// M7: FR-18 categories (admin). Uses its own e2e_* categories only.
import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, formMessage, gotoReady, loginAs, test } from "./fixtures";
import { categoriesInOrder, deleteTestCategories, E2E_CATEGORY_PREFIX } from "./support/tasks";

const uniqueName = (label: string) => `${E2E_CATEGORY_PREFIX}${label}_${randomBytes(3).toString("hex")}`;
const row = (page: Page, name: string) => page.locator(`li[data-category="${name}"]`);

async function addCategory(page: Page, name: string) {
  await page.getByLabel("เพิ่มหมวดหมู่").fill(name);
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  await expect(row(page, name)).toBeVisible();
}

test.afterAll(async () => {
  await deleteTestCategories();
});

test.describe("FR-18 categories", () => {
  test("admin adds, renames, reorders and turns categories off and on", async ({ page, makeUser }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const first = uniqueName("a");
    const second = uniqueName("b");
    const renamed = uniqueName("renamed");

    await loginAs(page, admin);
    await gotoReady(page, "/admin");
    await page.getByRole("link", { name: /หมวดหมู่งาน/ }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);

    // Add: new ones go to the end.
    await addCategory(page, first);
    await addCategory(page, second);
    const names = (await categoriesInOrder()).map((c) => c.name);
    expect(names.indexOf(second)).toBe(names.indexOf(first) + 1);

    // Duplicate names are rejected (case and spacing do not matter).
    await page.getByLabel("เพิ่มหมวดหมู่").fill(`  ${first.toUpperCase()} `);
    await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await expect(formMessage(page)).toHaveText("มีหมวดหมู่ชื่อนี้แล้ว");

    // Reorder: move the second one up, above the first.
    await page.getByRole("button", { name: `เลื่อน ${second} ขึ้น` }).click();
    await expect
      .poll(async () => {
        const list = (await categoriesInOrder()).map((c) => c.name);
        return list.indexOf(second) < list.indexOf(first);
      })
      .toBe(true);
    await expect
      .poll(async () => {
        const shown = await page
          .locator("li[data-category]")
          .evaluateAll((els) => els.map((e) => e.getAttribute("data-category") ?? ""));
        return shown.indexOf(first) - shown.indexOf(second);
      })
      .toBe(1);

    // Rename.
    await page.getByRole("button", { name: `แก้ชื่อ ${first}` }).click();
    await page.getByRole("dialog").getByLabel("ชื่อหมวดหมู่").fill(renamed);
    await page.getByRole("dialog").getByRole("button", { name: "บันทึก" }).click();
    await expect(row(page, renamed)).toBeVisible();
    await expect(row(page, first)).toHaveCount(0);

    // Turn off, then on again.
    await page.getByRole("button", { name: `ปิดใช้งาน ${renamed}`, exact: true }).click();
    await expect(page.getByRole("button", { name: `เปิดใช้งาน ${renamed}`, exact: true })).toBeVisible();
    await expect(row(page, renamed).locator('[data-slot="badge"]')).toHaveText("ปิดใช้งาน");
    expect((await categoriesInOrder()).find((c) => c.name === renamed)?.is_active).toBe(false);
    await page.getByRole("button", { name: `เปิดใช้งาน ${renamed}`, exact: true }).click();
    await expect(page.getByRole("button", { name: `ปิดใช้งาน ${renamed}`, exact: true })).toBeVisible();
    expect((await categoriesInOrder()).find((c) => c.name === renamed)?.is_active).toBe(true);
  });

  test("an inactive category is not offered for new tasks", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    const name = uniqueName("off");
    await loginAs(page, admin);
    await gotoReady(page, "/admin/categories");
    await addCategory(page, name);
    await page.getByRole("button", { name: `ปิดใช้งาน ${name}`, exact: true }).click();
    await expect(page.getByRole("button", { name: `เปิดใช้งาน ${name}`, exact: true })).toBeVisible();

    await gotoReady(page, "/board");
    await page.getByRole("button", { name: "เพิ่มงานใน งานค้างระยะสั้น" }).click();
    const options = await page
      .getByRole("dialog")
      .getByLabel("หมวดหมู่")
      .locator("option")
      .allTextContents();
    expect(options.some((o) => o.includes(name))).toBe(false);
  });

  test("normal users cannot open the page", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);
    await page.goto("/admin/categories");
    await expect(page).toHaveURL(/\/board$/);
  });
});
