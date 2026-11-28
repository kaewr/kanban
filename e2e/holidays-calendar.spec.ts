// BR-48 today banner + leave calendar, BR-49 holidays, BR-50 compact cards.
import { currentBoardYear, yearDateRange } from "../src/lib/board/year";
import { expect, gotoReady, loginAs, test } from "./fixtures";
import { cardByTitle } from "./support/board";
import { seedTasks } from "./support/tasks";
import { service } from "./support/users";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
/** Today, or the next Monday when today is a weekend (the calendar hides leave on weekends). */
const nextWeekday = () => {
  const d = new Date(`${today()}T00:00:00Z`);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

async function addLeave(ownerId: string, leaveType: string, startDate: string, endDate = startDate) {
  const { error } = await service()
    .from("leaves")
    .insert({ owner_id: ownerId, created_by: ownerId, leave_type: leaveType, start_date: startDate, end_date: endDate });
  if (error) throw new Error(error.message);
}

/** A date in the current fiscal year that has no holiday yet. */
async function freeHolidayDate(): Promise<string> {
  const { data: settings } = await service().from("app_settings").select("fiscal_start_month").single();
  const month = settings?.fiscal_start_month ?? 10;
  const { from, to } = yearDateRange(currentBoardYear({ yearType: "fiscal", fiscalStartMonth: month }), "fiscal", month);
  const { data } = await service().from("holidays").select("holiday_date").gte("holiday_date", from).lte("holiday_date", to);
  const taken = new Set((data ?? []).map((h) => h.holiday_date));
  const start = Date.parse(`${from}T00:00:00Z`) + Math.floor(Math.random() * 300) * 86_400_000;
  for (let t = start; ; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (date > to) throw new Error("no free date");
    if (!taken.has(date)) return date;
  }
}

test.describe("holidays (BR-49)", () => {
  test("admin adds and removes a holiday; it is only a label", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    const date = await freeHolidayDate();
    const name = `e2e_วันหยุด_${Date.now()}`;
    try {
      await loginAs(page, admin);
      await gotoReady(page, "/admin");
      await page.getByRole("link", { name: /วันหยุดราชการ/ }).click();
      await expect(page).toHaveURL(/\/admin\/holidays$/);

      await page.getByLabel("วันที่").fill(date);
      await page.getByLabel("ชื่อวันหยุด").fill(name);
      await page.getByRole("button", { name: "เพิ่มวันหยุด" }).click();
      const row = page.locator(`li[data-holiday="${date}"]`);
      await expect(row).toContainText(name);

      // Same date again is rejected.
      await page.getByLabel("วันที่").fill(date);
      await page.getByLabel("ชื่อวันหยุด").fill(`${name}_2`);
      await page.getByRole("button", { name: "เพิ่มวันหยุด" }).click();
      await expect(page.getByText("วันที่นี้มีวันหยุดอยู่แล้ว")).toBeVisible();

      await row.getByRole("button", { name: `ลบวันหยุด ${name}` }).click();
      await expect(row).toHaveCount(0);
      const { data } = await service().from("holidays").select("id").eq("holiday_date", date);
      expect(data).toHaveLength(0);
    } finally {
      await service().from("holidays").delete().like("name", `${name}%`);
    }
  });

  test("a normal user cannot open the holidays page", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);
    await page.goto("/admin/holidays");
    await expect(page.getByRole("heading", { name: "วันหยุดราชการ" })).toHaveCount(0);
  });
});

test.describe("today banner (BR-48)", () => {
  test("shows today's leave to the owner and to an admin; today's holiday to everyone", async ({ browser, makeUser }) => {
    const user = await makeUser();
    const admin = await makeUser({ role: "admin" });
    const date = today();
    await addLeave(user.id, "sick", date);

    const { data: existing } = await service().from("holidays").select("name").eq("holiday_date", date).maybeSingle();
    const holidayName = existing?.name ?? `e2e_วันหยุดวันนี้_${Date.now()}`;
    if (!existing) await service().from("holidays").insert({ holiday_date: date, name: holidayName });

    try {
      const ownPage = await browser.newPage();
      await loginAs(ownPage, user);
      const own = ownPage.getByTestId("today-banner");
      await expect(own.getByTestId("today-leave")).toHaveText("วันนี้คุณลาป่วย");
      await expect(own.getByTestId("today-holiday")).toContainText(holidayName);
      await ownPage.close();

      const adminPage = await browser.newPage();
      await loginAs(adminPage, admin);
      // The admin is not on leave: only the holiday shows on their own board.
      await expect(adminPage.getByTestId("today-leave")).toHaveCount(0);
      await expect(adminPage.getByTestId("today-holiday")).toContainText(holidayName);
      await gotoReady(adminPage, `/board?user=${user.username}`);
      await expect(adminPage.getByTestId("today-leave")).toHaveText(`${user.displayName} ลาป่วยวันนี้`);
      await adminPage.close();
    } finally {
      if (!existing) await service().from("holidays").delete().eq("holiday_date", date).eq("name", holidayName);
    }
  });

  test("no leave line for someone who is not on leave", async ({ page, makeUser }) => {
    // Other tests may add a holiday for today in parallel, so only the leave line is checked.
    const user = await makeUser();
    await loginAs(page, user);
    await expect(page.getByTestId("today-leave")).toHaveCount(0);
  });
});

test.describe("leave calendar (BR-48)", () => {
  test("a user sees only their own leave; an admin sees everyone's", async ({ browser, makeUser }) => {
    const user = await makeUser();
    const other = await makeUser();
    const admin = await makeUser({ role: "admin" });
    const date = nextWeekday();
    await addLeave(user.id, "vacation", date);
    await addLeave(other.id, "personal", date);

    const userPage = await browser.newPage();
    await loginAs(userPage, user);
    await gotoReady(userPage, "/leave");
    await userPage.getByRole("link", { name: "ปฏิทินวันลา" }).click();
    await expect(userPage).toHaveURL(/\/leave\/calendar$/);
    const month = date.slice(0, 7); // may be next month when today is a weekend at month end
    if (month !== today().slice(0, 7)) await gotoReady(userPage, `/leave/calendar?month=${month}`);
    const userCell = userPage.getByTestId("calendar-grid").locator(`[data-date="${date}"]`);
    await expect(userCell.getByTestId("calendar-leave")).toHaveText(["ลาพักผ่อน"]);
    await expect(userPage.getByText(other.displayName)).toHaveCount(0);
    await userPage.close();

    const adminPage = await browser.newPage();
    await loginAs(adminPage, admin);
    await gotoReady(adminPage, `/leave/calendar?month=${month}`);
    const adminCell = adminPage.getByTestId("calendar-grid").locator(`[data-date="${date}"]`);
    await expect(adminCell).toContainText(`${user.displayName} · ลาพักผ่อน`);
    await expect(adminCell).toContainText(`${other.displayName} · ลากิจ`);

    // Month navigation keeps working and comes back.
    const thisMonth = await adminPage.getByTestId("calendar-month").textContent();
    await adminPage.getByRole("link", { name: "เดือนถัดไป" }).click();
    await expect(adminPage).toHaveURL(/month=/);
    await expect(adminPage.getByTestId("calendar-month")).not.toHaveText(thisMonth ?? "");
    await adminPage.getByRole("link", { name: "เดือนก่อนหน้า" }).click();
    await expect(adminPage.getByTestId("calendar-month")).toHaveText(thisMonth ?? "");
    await expect(adminPage.getByTestId("calendar-grid").locator(`[data-date="${date}"]`)).toContainText(user.displayName);
    await adminPage.close();
  });
});

test.describe("compact cards (BR-50)", () => {
  test("switches to compact cards, remembers it after reload, and switches back", async ({ page, makeUser }) => {
    const user = await makeUser();
    await seedTasks(user.id, [{ title: "งานทดสอบการ์ดย่อ", status: "short_term" }]);
    await loginAs(page, user);

    const cardEl = cardByTitle(page, "งานทดสอบการ์ดย่อ");
    await expect(cardEl.locator('[data-density="compact"]')).toHaveCount(0);
    await page.getByRole("button", { name: "กะทัดรัด" }).click();
    await expect(page.getByRole("button", { name: "กะทัดรัด" })).toHaveAttribute("aria-pressed", "true");
    await expect(cardEl.locator('[data-density="compact"]')).toHaveCount(1);

    await page.reload();
    await expect(cardEl.locator('[data-density="compact"]')).toHaveCount(1);

    // Editing still works from a compact card.
    await cardEl.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "ปกติ" }).click();
    await expect(cardEl.locator('[data-density="compact"]')).toHaveCount(0);
  });
});
