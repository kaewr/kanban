// M7: FR-19 year settings (admin).
// Other test files run in parallel and depend on the current board year, so the only
// value actually saved here is "fiscal starting in January", which keeps the year number
// the same as the calendar year. The original settings are restored afterwards.
import { currentBoardYear } from "../src/lib/board/year";
import { expect, formMessage, gotoReady, loginAs, test } from "./fixtures";
import { setYearSettings, yearSettings } from "./support/tasks";

test.describe("FR-19 year settings", () => {
  test("admin previews and saves the year type; the board follows", async ({ page, makeUser }) => {
    const original = await yearSettings();
    const admin = await makeUser({ role: "admin" });
    try {
      await setYearSettings("calendar", 10);
      await loginAs(page, admin);
      await gotoReady(page, "/admin/settings");

      const calendarYear = currentBoardYear({ yearType: "calendar", fiscalStartMonth: 10 });
      await expect(page.getByTestId("year-preview")).toHaveText(`ปีปัจจุบันของบอร์ดจะเป็น พ.ศ. ${calendarYear}`);
      await expect(page.getByRole("button", { name: "บันทึก" })).toBeDisabled();

      // Preview only: fiscal year starting in October (BR-10).
      await page.getByRole("radio", { name: /ปีงบประมาณ/ }).check();
      await expect(page.getByLabel("เดือนเริ่มปีงบประมาณ")).toHaveValue("10");
      const fiscalOct = currentBoardYear({ yearType: "fiscal", fiscalStartMonth: 10 });
      await expect(page.getByTestId("year-preview")).toHaveText(`ปีปัจจุบันของบอร์ดจะเป็น ปีงบประมาณ ${fiscalOct}`);

      // Save fiscal from January (same year number, safe for parallel tests).
      await page.getByLabel("เดือนเริ่มปีงบประมาณ").selectOption("1");
      await page.getByRole("button", { name: "บันทึก" }).click();
      await expect(formMessage(page)).toHaveText("บันทึกการตั้งค่าแล้ว");
      expect(await yearSettings()).toEqual({ year_type: "fiscal", fiscal_start_month: 1, updated_by: admin.id });

      await gotoReady(page, "/board");
      await expect(page.getByLabel("เลือกปี").locator("option:checked")).toHaveText(`ปีงบประมาณ ${calendarYear}`);
    } finally {
      await setYearSettings(original.year_type, original.fiscal_start_month);
    }
  });

  test("normal users cannot open the page", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/board$/);
  });
});
