// BR-58: description line on cards, date-times on cards, move history in the dialog.
import type { Page } from "@playwright/test";
import { expect, loginAs, test } from "./fixtures";
import { cardByTitle, unsavedCount } from "./support/board";
import { firstCategory } from "./support/tasks";

const DATE_TIME = /^\d{1,2} \S+ \d{4} \d{2}:\d{2}$/;

async function save(page: Page) {
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(unsavedCount(page)).toHaveText("บันทึกแล้ว");
}

test("cards show a description line and times; the dialog lists every move", async ({ page, makeUser }) => {
  test.slow();
  const user = await makeUser();
  const category = await firstCategory();
  const description = "สรุปผลการประชุมคณะกรรมการประจำคณะ ครั้งที่ 11/2569 พร้อมแนบมติที่ประชุม";
  await loginAs(page, user);

  await page.getByRole("button", { name: "เพิ่มงานใน งานค้างระยะสั้น" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่องาน").fill("บันทึกข้อความ");
  await dialog.getByLabel("รายละเอียด").fill(description);
  await dialog.getByLabel("หมวดหมู่").selectOption(category.id);
  await dialog.getByRole("button", { name: "เพิ่มงาน" }).click();
  await save(page);

  const card = cardByTitle(page, "บันทึกข้อความ");
  const line = card.getByTestId("task-description");
  await expect(line).toHaveText(description);
  await expect(line).toHaveAttribute("title", description);
  // One line only: the text is cut by the card width.
  expect(await line.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

  await expect(card.getByTestId("task-created")).toHaveText(DATE_TIME);
  await expect(card.getByTestId("task-arrived")).toHaveCount(0); // still in the first column

  await card.getByRole("button", { name: "ตัวเลือกงาน บันทึกข้อความ" }).click();
  await page.getByRole("menuitem", { name: "กำลังทำ" }).click();
  await expect(card.getByTestId("task-arrived")).toHaveText(DATE_TIME);
  await expect(card.getByTestId("task-started")).toHaveText(DATE_TIME);

  await card.click();
  const history = page.getByRole("dialog").getByTestId("task-history");
  await expect(history.locator("li")).toHaveCount(2);
  await expect(history.locator("li").nth(0)).toContainText('สร้างใน "งานค้างระยะสั้น"');
  await expect(history.locator("li").nth(1)).toContainText('→ "กำลังทำ"');
  await expect(history.locator("li").nth(1)).toContainText("(ยังไม่บันทึก)");
  await page.keyboard.press("Escape");

  // After saving (and after a reload) the move is part of the saved history.
  await save(page);
  await page.reload();
  await expect(card.getByTestId("task-arrived")).toHaveText(DATE_TIME);
  await card.click();
  await expect(history.locator("li")).toHaveCount(2);
  await expect(history).not.toContainText("ยังไม่บันทึก");
});
