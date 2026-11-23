// BR-51 task title presets, BR-52 due date defaults to today for new tasks.
import { expect, formMessage, gotoReady, loginAs, test } from "./fixtures";
import { cardByTitle } from "./support/board";
import { service } from "./support/users";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

test.describe("task title presets (BR-51)", () => {
  test("admin adds, renames, reorders and removes a preset", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    const name = `e2e_หัวข้อ_${Date.now()}`;
    try {
      await loginAs(page, admin);
      await gotoReady(page, "/admin");
      await page.getByRole("link", { name: /หัวข้องาน/ }).click();
      await expect(page).toHaveURL(/\/admin\/task-titles$/);

      await page.getByLabel("เพิ่มหัวข้องาน").fill(name);
      await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
      const list = page.getByTestId("preset-list");
      await expect(list.locator("li").last()).toHaveAttribute("data-preset", name);

      // Duplicate (ignoring case and spaces) is rejected.
      await page.getByLabel("เพิ่มหัวข้องาน").fill(`  ${name.toUpperCase()} `);
      await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
      await expect(formMessage(page).first()).toHaveText("มีหัวข้องานนี้แล้ว");

      await page.getByRole("button", { name: `เลื่อน ${name} ขึ้น` }).click();
      await expect(list.locator("li").last()).not.toHaveAttribute("data-preset", name);

      await page.getByRole("button", { name: `แก้ชื่อ ${name}` }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("หัวข้องาน").fill(`${name}_ใหม่`);
      await dialog.getByRole("button", { name: "บันทึก" }).click();
      await expect(list.locator(`li[data-preset="${name}_ใหม่"]`)).toHaveCount(1);

      await page.getByRole("button", { name: `ลบ ${name}_ใหม่` }).click();
      await expect(list.locator(`li[data-preset^="${name}"]`)).toHaveCount(0);
    } finally {
      await service().from("task_title_presets").delete().like("name", `${name}%`);
    }
  });

  test("a user picks a preset, edits the title, and new tasks are due today", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);

    await page.getByRole("button", { name: "เพิ่มงานใน งานค้างระยะสั้น" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("วันกำหนดเสร็จ")).toHaveValue(today());

    await dialog.getByLabel("หัวข้องาน").selectOption("จัดทำรายงาน");
    const title = dialog.getByLabel("ชื่องาน");
    await expect(title).toHaveValue("จัดทำรายงาน");
    await expect(title).toBeFocused();
    await title.press("End");
    await title.pressSequentially(" ไตรมาส 1");
    await dialog.getByLabel("หมวดหมู่").selectOption({ index: 1 });
    await dialog.getByRole("button", { name: "เพิ่มงาน" }).click();

    const card = cardByTitle(page, "จัดทำรายงาน ไตรมาส 1");
    await expect(card).toHaveCount(1);
    await expect(card.getByTestId("task-due-state")).toHaveText("ครบกำหนดวันนี้");

    // Long-term work has no default due date.
    await page.getByRole("button", { name: "เพิ่มงานใน งานระยะยาว (ภายในปี)" }).click();
    await expect(page.getByRole("dialog").getByLabel("วันกำหนดเสร็จ")).toHaveValue("");
    await page.keyboard.press("Escape");

    // Typing a title without a preset still works.
    await page.getByRole("button", { name: "เพิ่มงานใน งานค้างระยะสั้น" }).click();
    await page.getByRole("dialog").getByLabel("ชื่องาน").fill("งานพิมพ์เอง");
    await page.getByRole("dialog").getByLabel("หมวดหมู่").selectOption({ index: 1 });
    await page.getByRole("dialog").getByRole("button", { name: "เพิ่มงาน" }).click();
    await expect(cardByTitle(page, "งานพิมพ์เอง")).toHaveCount(1);
  });
});
