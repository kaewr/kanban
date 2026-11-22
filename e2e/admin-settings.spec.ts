// FR-19 (changed 22 Nov 2026): admin sets the shared fiscal start month.
// Other test files run in parallel and depend on the current fiscal year, so the only
// value saved here is a month that keeps the same fiscal year number. Restored afterwards.
import { currentBoardYear, THAI_MONTHS } from "../src/lib/board/year";
import { expect, formMessage, gotoReady, loginAs, test } from "./fixtures";
import { fiscalSettings, setFiscalStartMonth } from "./support/tasks";

const fiscalYear = (month: number) => currentBoardYear({ yearType: "fiscal", fiscalStartMonth: month });

test.describe("FR-19 fiscal start month", () => {
  test("admin previews and saves the fiscal start month", async ({ page, makeUser }) => {
    const original = await fiscalSettings();
    const admin = await makeUser({ role: "admin" });
    const start = original.fiscal_start_month;
    // A different month (2..12) that gives the same fiscal year as now.
    const neutral = [...Array(11).keys()].map((i) => i + 2).find((m) => m !== start && fiscalYear(m) === fiscalYear(start));
    const changing = [...Array(11).keys()].map((i) => i + 2).find((m) => fiscalYear(m) !== fiscalYear(start));
    try {
      await loginAs(page, admin);
      await gotoReady(page, "/admin/settings");
      await expect(page.getByTestId("year-preview")).toContainText(`ปีงบประมาณปัจจุบัน ${fiscalYear(start)}`);
      await expect(page.getByRole("button", { name: "บันทึก" })).toBeDisabled();

      if (changing) {
        await page.getByLabel("เดือนเริ่มปีงบประมาณ").selectOption(String(changing));
        await expect(page.getByTestId("year-preview")).toContainText(`ปีงบประมาณปัจจุบัน ${fiscalYear(changing)}`);
        await expect(page.getByTestId("year-preview")).toContainText(THAI_MONTHS[changing - 1]);
      }

      expect(neutral).toBeDefined();
      await page.getByLabel("เดือนเริ่มปีงบประมาณ").selectOption(String(neutral));
      await page.getByRole("button", { name: "บันทึก" }).click();
      await expect(formMessage(page)).toHaveText("บันทึกการตั้งค่าแล้ว");
      expect(await fiscalSettings()).toEqual({ fiscal_start_month: neutral, updated_by: admin.id });
    } finally {
      await setFiscalStartMonth(start);
    }
  });

  test("normal users cannot open the page", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/board$/);
  });
});
