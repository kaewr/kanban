// M8: FR-16 dashboard. Users see their own numbers; admins see everyone and can narrow down.
import { expect, gotoReady, loginAs, test } from "./fixtures";
import { categoryByName, currentYear, seedHistory, seedTasks } from "./support/tasks";
import { signedInClient } from "./support/users";

const day = 86_400_000;
const bangkok = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(Date.now() + offsetDays * day));
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

async function seedWorkload(ownerId: string) {
  const routine = await categoryByName("งานประจำ");
  const tasks = await seedTasks(ownerId, [
    { title: "ค้างเลยกำหนด", status: "in_progress", startedAt: iso(-5), dueDate: bangkok(-1) },
    { title: "รอตรวจ", status: "review", startedAt: iso(-6) },
    { title: "ระยะยาว", status: "long_term", progress: 40 },
    // Done today: 2 days and 4 days of cycle time -> average 3.
    { title: "เสร็จหนึ่ง", status: "done", startedAt: iso(-2), completedAt: iso(0), categoryId: routine.id },
    { title: "เสร็จสอง", status: "done", startedAt: iso(-4), completedAt: iso(0), categoryId: routine.id },
  ]);
  const review = tasks[1];
  // In review 2 days, sent back once, then in review again (still there).
  await seedHistory([
    { taskId: review.id, from: "in_progress", to: "review", by: ownerId, at: iso(-6) },
    { taskId: review.id, from: "review", to: "in_progress", by: ownerId, at: iso(-4) },
    { taskId: review.id, from: "in_progress", to: "review", by: ownerId, at: iso(-3) },
  ]);
}

test.describe("FR-16 dashboard", () => {
  test("a user sees their own numbers only", async ({ page, makeUser }) => {
    test.slow();
    const user = await makeUser();
    const other = await makeUser();
    await seedWorkload(user.id);
    await seedTasks(other.id, [{ title: "ของคนอื่น", status: "short_term", dueDate: bangkok(-10) }]);

    await loginAs(page, user);
    await gotoReady(page, "/dashboard");
    await expect(page.getByText("ภาพรวมงานของคุณ", { exact: false })).toBeVisible();

    const value = (id: string) => page.getByTestId(`${id}-value`);
    await expect(value("stat-open")).toHaveText("3");
    await expect(value("stat-overdue")).toHaveText("1");
    await expect(value("stat-done-month")).toHaveText("2");
    await expect(value("stat-cycle")).toHaveText("3 วัน");
    await expect(value("stat-review-wait")).toHaveText("2 วัน");
    await expect(value("stat-rework")).toHaveText("100%");
    await expect(page.getByTestId("status-counts").locator('[data-status="done"]')).toHaveText("2");

    // Category chart has a table view.
    await page.getByText("ดูเป็นตาราง").last().click();
    await expect(page.getByRole("rowheader", { name: "งานประจำ" })).toBeVisible();

    // No people table or admin filters for users.
    await expect(page.getByTestId("people-table")).toHaveCount(0);
    await expect(page.getByLabel("สังกัดงาน")).toHaveCount(0);
    await expect(page.getByLabel("บุคคล")).toHaveCount(0);
  });

  test("admin sees everyone, the people table and can narrow to one person", async ({ page, makeUser }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();
    await seedWorkload(user.id);

    await loginAs(page, admin);
    await gotoReady(page, "/dashboard");
    const row = page.getByTestId("people-table").locator(`tr[data-person="${user.displayName}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText("งานวิชาการ");

    await page.getByLabel("บุคคล").selectOption(user.id);
    await expect(page).toHaveURL(new RegExp(`user=${user.id}`));
    await expect(page.getByTestId("stat-open-value")).toHaveText("3");
    await expect(page.getByTestId("stat-overdue-value")).toHaveText("1");
    await expect(page.getByTestId("people-table")).toHaveCount(0);

    await page.getByLabel("สังกัดงาน").selectOption("planning");
    await expect(page).toHaveURL(/unit=planning/);
    await expect(page).not.toHaveURL(/user=/);
  });

  test("dashboard_summary follows RLS when called directly", async ({ makeUser }) => {
    const user = await makeUser();
    const other = await makeUser();
    await seedTasks(other.id, [{ title: "ลับ", status: "short_term" }]);
    const year = await currentYear();

    const client = await signedInClient(user);
    const { data, error } = await client.rpc("dashboard_summary", { p_year: year, p_owner_id: other.id });
    expect(error).toBeNull();
    expect(data).toMatchObject({ totals: { open: 0 }, people: [] });
  });
});
