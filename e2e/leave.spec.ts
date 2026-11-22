// Leave records (BR-40..44): single day or range, working days only, overlap check,
// edit / cancel, admin records for others, monthly summary on the dashboard.
import type { Locator, Page } from "@playwright/test";
import { currentBoardYear, yearDateRange } from "../src/lib/board/year";
import { expect, formMessage, gotoReady, loginAs, test } from "./fixtures";
import { service } from "./support/users";

/** A Monday well inside the current fiscal year, plus helpers to step from it. */
async function dates() {
  const { data } = await service().from("app_settings").select("fiscal_start_month").single();
  const month = data?.fiscal_start_month ?? 10;
  const year = currentBoardYear({ yearType: "fiscal", fiscalStartMonth: month });
  const { from } = yearDateRange(year, "fiscal", month);
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 40);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); // Monday
  const plus = (n: number) => new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  return { monday: plus(0), plus };
}

async function fillLeave(scope: Page | Locator, v: { type: string; start: string; end?: string; note?: string }) {
  await scope.getByLabel("ประเภทการลา").selectOption({ label: v.type });
  if (v.end) {
    await scope.getByLabel("หลายวัน (ช่วงวันที่)").check();
    await scope.getByLabel("ตั้งแต่วันที่").fill(v.start);
    await scope.getByLabel("ถึงวันที่").fill(v.end);
  } else {
    await scope.getByLabel("วันเดียว").check();
    await scope.getByLabel("วันที่ลา").fill(v.start);
  }
  if (v.note !== undefined) await scope.getByLabel("หมายเหตุ (ไม่บังคับ)").fill(v.note);
}

test.describe("leave", () => {
  test("user records, edits and cancels leave; weekends are not counted; overlaps are rejected", async ({
    page,
    makeUser,
  }) => {
    test.slow();
    const user = await makeUser();
    const { monday, plus } = await dates();
    await loginAs(page, user);
    await page.getByRole("navigation").getByRole("link", { name: "วันลา" }).click();
    await expect(page).toHaveURL(/\/leave$/);

    // Single day.
    await fillLeave(page, { type: "ลาป่วย", start: monday });
    await expect(page.getByTestId("leave-days-preview")).toContainText("รวม 1 วันทำการ");
    await page.getByRole("button", { name: "บันทึกวันลา" }).click();
    await expect(formMessage(page).first()).toHaveText("บันทึกวันลาแล้ว");

    // Range Thursday .. next Tuesday = 4 working days (weekend skipped).
    await fillLeave(page, { type: "ลาราชการ", start: plus(3), end: plus(8), note: "อบรมที่กรุงเทพฯ" });
    await expect(page.getByTestId("leave-days-preview")).toContainText("รวม 4 วันทำการ");
    await page.getByRole("button", { name: "บันทึกวันลา" }).click();
    await expect(formMessage(page).first()).toHaveText("บันทึกวันลาแล้ว");

    const list = page.getByTestId("leave-list");
    await expect(list.locator("li")).toHaveCount(2);
    await expect(list).toContainText("อบรมที่กรุงเทพฯ");
    await expect(page.getByTestId("leave-total")).toHaveText("5");
    await expect(page.getByTestId("leave-by-type")).toContainText("ลาราชการ");

    // Overlap with the range is rejected by the database (BR-42).
    await fillLeave(page, { type: "ลากิจ", start: plus(7) });
    await page.getByRole("button", { name: "บันทึกวันลา" }).click();
    await expect(formMessage(page).first()).toHaveText("มีวันลาที่ซ้อนกับช่วงวันที่นี้อยู่แล้ว");

    // A weekend-only range has no working days.
    await fillLeave(page, { type: "ลากิจ", start: plus(5), end: plus(6) });
    await page.getByRole("button", { name: "บันทึกวันลา" }).click();
    await expect(page.getByText("ช่วงที่เลือกไม่มีวันทำการ (จันทร์–ศุกร์)")).toBeVisible();

    // Edit the single day into a two-day sick leave.
    await list.getByRole("button", { name: /แก้ไขวันลา/ }).last().click();
    const dialog = page.getByRole("dialog");
    await fillLeave(dialog, { type: "ลาป่วย", start: monday, end: plus(1) });
    await dialog.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("leave-total")).toHaveText("6");

    // Cancel the range.
    await list.getByRole("button", { name: /ยกเลิกวันลา/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "ยกเลิกวันลา" }).click();
    await expect(list.locator("li")).toHaveCount(1);
    await expect(page.getByTestId("leave-total")).toHaveText("2");

    const { data } = await service().from("leaves").select("leave_type, is_deleted").eq("owner_id", user.id);
    expect(data).toHaveLength(2); // soft delete keeps the row
    expect(data?.filter((l) => l.is_deleted)).toHaveLength(1);

    // User dashboard shows their own leave days.
    await gotoReady(page, "/dashboard");
    await expect(page.getByTestId("stat-leave-year-value")).toHaveText("2 วัน");
    await expect(page.getByTestId("leave-table")).toHaveCount(0);
  });

  test("admin records leave for a user and sees the monthly table on the dashboard", async ({ page, makeUser }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();
    const { monday, plus } = await dates();

    await loginAs(page, admin);
    await gotoReady(page, "/leave");
    await page.getByLabel("วันลาของ").selectOption(user.id);
    await expect(page).toHaveURL(new RegExp(`user=${user.id}`));
    await expect(page.getByText(`วันลาของ ${user.displayName}`)).toBeVisible();

    await fillLeave(page, { type: "ลาพักผ่อน", start: monday, end: plus(2) });
    await page.getByRole("button", { name: "บันทึกวันลา" }).click();
    await expect(formMessage(page).first()).toHaveText("บันทึกวันลาแล้ว");
    await expect(page.getByTestId("leave-list")).toContainText("บันทึกโดย");

    const { data } = await service().from("leaves").select("owner_id, created_by").eq("owner_id", user.id).single();
    expect(data).toEqual({ owner_id: user.id, created_by: admin.id });

    await gotoReady(page, "/dashboard");
    const row = page.getByTestId("leave-table").locator(`tr[data-person="${user.displayName}"]`);
    await expect(row.getByTestId("leave-row-total")).toHaveText("3");
    await expect(row.locator(`td[data-month="${monday.slice(0, 7)}"]`)).not.toHaveText("0");
    await expect(row).toContainText("ลาพักผ่อน");
  });

  test("a user cannot record leave for someone else", async ({ page, makeUser }) => {
    const user = await makeUser();
    const other = await makeUser();
    await loginAs(page, user);
    await gotoReady(page, `/leave?user=${other.id}`);
    await expect(page.getByText("แจ้งวันลาของคุณ")).toBeVisible(); // ?user= ignored
    await expect(page.getByLabel("วันลาของ")).toHaveCount(0);
  });
});
