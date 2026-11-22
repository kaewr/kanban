// Profile settings: own name and year type (BR-31); unit and position are read-only (BR-30).
import { expect, formMessage, gotoReady, loginAs, test } from "./fixtures";
import { currentYear } from "./support/tasks";
import { getProfile } from "./support/users";

test("user edits own name and year type; unit and position stay read-only", async ({
  page,
  makeUser,
  newDisplayName,
}) => {
  test.slow();
  const user = await makeUser({ position: "นักวิชาการศึกษา" });
  const fiscal = await currentYear("fiscal");
  const calendar = await currentYear("calendar");
  await loginAs(page, user);

  // Default: fiscal year (BR-31).
  await expect(page.getByLabel("เลือกปี").locator("option:checked")).toHaveText(`ปีงบประมาณ ${fiscal}`);

  await gotoReady(page, "/profile");
  await expect(page.getByTestId("profile-org")).toContainText("งานวิชาการ");
  await expect(page.getByTestId("profile-org")).toContainText("นักวิชาการศึกษา");
  await expect(page.getByLabel("ตำแหน่ง")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /ปีงบประมาณ/ })).toBeChecked();

  const newName = newDisplayName();
  await page.getByLabel("ชื่อ-นามสกุล").fill(newName);
  await page.getByRole("radio", { name: /ปี พ\.ศ\./ }).check();
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(formMessage(page).first()).toHaveText("บันทึกข้อมูลแล้ว");
  await expect(page.getByRole("link", { name: newName })).toBeVisible(); // header

  expect(await getProfile(user.username)).toMatchObject({
    display_name: newName,
    position: "นักวิชาการศึกษา",
  });

  await gotoReady(page, "/board");
  await expect(page.getByLabel("เลือกปี").locator("option:checked")).toHaveText(`พ.ศ. ${calendar}`);
});

test("a name used by another active account is rejected", async ({ page, makeUser }) => {
  const user = await makeUser();
  const other = await makeUser();
  await loginAs(page, user);
  await gotoReady(page, "/profile");
  await page.getByLabel("ชื่อ-นามสกุล").fill(other.displayName);
  await page.getByRole("button", { name: "บันทึก" }).click();
  await expect(formMessage(page).first()).toHaveText("มีผู้ใช้ชื่อนี้อยู่แล้ว");
});
