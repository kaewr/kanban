// M3: FR-01, FR-02 (warning only since 2026-11-20), FR-03, BR-20..24 (login by name since 2026-11-22), BR-26
import { defaultPasswordBanner, expect, formMessage, gotoReady, login, loginAs, logout, test } from "./fixtures";
import { defaultPassword, setActive } from "./support/users";

const INVALID_CREDENTIALS = "รหัสผ่านไม่ถูกต้อง";
const INACTIVE = /ถูกปิดการใช้งาน/;
const BOARD_URL = /\/board$/;

test.describe("FR-01 login", () => {
  test("signed-out visitor is sent to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "เข้าสู่ระบบ" })).toBeVisible();
  });

  test("wrong password shows a generic error", async ({ page, makeUser }) => {
    const user = await makeUser();
    await login(page, user.displayName, "wrong-password");
    await expect(formMessage(page)).toHaveText(INVALID_CREDENTIALS);
    await expect(page).toHaveURL(/\/login/);
  });

  test("BR-20: active accounts are listed by unit; the internal username and email are never shown", async ({
    page,
    makeUser,
  }) => {
    const user = await makeUser({ position: "นักวิชาการศึกษา" });
    const planner = await makeUser({ unitId: "planning" });
    const inactive = await makeUser();
    await setActive(inactive.id, false);

    await gotoReady(page, "/login");
    const select = page.getByLabel("ชื่อผู้ใช้");
    await expect(select.locator('optgroup[label="งานวิชาการ"] option', { hasText: user.displayName })).toHaveCount(1);
    await expect(select.locator('optgroup[label="งานแผนงาน"] option', { hasText: planner.displayName })).toHaveCount(1);
    await expect(select.locator("option", { hasText: inactive.displayName })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(user.username);

    // A name must be chosen (native required) before submitting.
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill("whatever");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page).toHaveURL(/\/login/);

    await loginAs(page, user);
    await expect(page.getByRole("link", { name: user.displayName })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("@kanban.local");
    await expect(page.locator("body")).not.toContainText(user.username);
  });

  test("returns to the originally requested page", async ({ page, makeUser }) => {
    const user = await makeUser();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    await loginAs(page, user, /\/dashboard$/);
  });

  test("logout returns to /login and protects pages again", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);
    await gotoReady(page, "/profile");
    await logout(page);
    await page.goto("/board");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("FR-02 default-password warning", () => {
  test("default-password account can use the app but sees a warning until it changes the password", async ({ page, makeUser }) => {
    test.slow(); // many sequential round trips
    const user = await makeUser({ mustChangePassword: true });
    await loginAs(page, { displayName: user.displayName, password: defaultPassword() });

    // Not blocked: every page opens, and each shows the warning banner.
    for (const path of ["/board", "/dashboard", "/profile"]) {
      await gotoReady(page, path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(defaultPasswordBanner(page)).toBeVisible();
    }

    // Banner links to the profile page.
    await gotoReady(page, "/board");
    await defaultPasswordBanner(page).getByRole("link", { name: "เปลี่ยนรหัสผ่าน" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await gotoReady(page, "/profile");

    const current = page.getByLabel("รหัสผ่านปัจจุบัน");
    const newPassword = page.getByLabel("รหัสผ่านใหม่", { exact: true });
    const confirm = page.getByLabel("ยืนยันรหัสผ่านใหม่");
    const submit = page.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" });

    // BR-24: the default password cannot be chosen again. It may be shorter than the
    // 8-character minimum (BR-59), so lift the browser check to reach the server rule.
    await newPassword.evaluate((el) => el.removeAttribute("minlength"));
    await confirm.evaluate((el) => el.removeAttribute("minlength"));
    await current.fill(defaultPassword());
    await newPassword.fill(defaultPassword());
    await confirm.fill(defaultPassword());
    await submit.click();
    await expect(formMessage(page)).toContainText("ห้ามใช้รหัสผ่านเริ่มต้น");
    await expect(defaultPasswordBanner(page)).toBeVisible();

    await current.fill(defaultPassword());
    await newPassword.fill("new-pass-1");
    await confirm.fill("new-pass-1");
    await submit.click();
    await expect(formMessage(page)).toContainText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");

    // Banner disappears right away and stays gone.
    await expect(defaultPasswordBanner(page)).toHaveCount(0);
    await gotoReady(page, "/board");
    await expect(defaultPasswordBanner(page)).toHaveCount(0);

    await gotoReady(page, "/profile");
    await logout(page);
    await loginAs(page, { displayName: user.displayName, password: "new-pass-1" });
    await expect(defaultPasswordBanner(page)).toHaveCount(0);
  });

  test("account with a changed password sees no warning", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);
    await expect(defaultPasswordBanner(page)).toHaveCount(0);
  });

  test("old /change-password link goes to the profile page", async ({ page, makeUser }) => {
    const user = await makeUser({ mustChangePassword: true });
    await loginAs(page, { displayName: user.displayName, password: defaultPassword() });
    await page.goto("/change-password");
    await expect(page).toHaveURL(/\/profile$/);
  });
});

test.describe("FR-03 change own password", () => {
  test("requires the current password and accepts a valid change", async ({ page, makeUser }) => {
    test.slow(); // many sequential round trips
    const user = await makeUser();
    await loginAs(page, user);
    await gotoReady(page, "/profile");

    const current = page.getByLabel("รหัสผ่านปัจจุบัน");
    const newPassword = page.getByLabel("รหัสผ่านใหม่", { exact: true });
    const confirm = page.getByLabel("ยืนยันรหัสผ่านใหม่");
    const submit = page.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" });

    await current.fill("not-my-password");
    await newPassword.fill("changed-pass");
    await confirm.fill("changed-pass");
    await submit.click();
    await expect(formMessage(page)).toContainText("รหัสผ่านปัจจุบันไม่ถูกต้อง");

    await current.fill(user.password);
    await newPassword.fill("changed-pass");
    await confirm.fill("changed-pass");
    await submit.click();
    await expect(formMessage(page)).toContainText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");

    // Session stays valid after the change.
    await page.goto("/board");
    await expect(page).toHaveURL(BOARD_URL);

    await gotoReady(page, "/profile");
    await logout(page);
    await loginAs(page, { displayName: user.displayName, password: "changed-pass" });
  });
});

test.describe("menu and roles", () => {
  test("user sees board and dashboard but not admin", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "บอร์ด" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);

    await page.goto("/admin");
    await expect(page).toHaveURL(BOARD_URL);
  });

  test("admin sees and can open the admin menu", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    await loginAs(page, admin);
    await page.getByRole("navigation").getByRole("link", { name: "Admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  });
});

test.describe("BR-26 inactive accounts", () => {
  test("inactive account cannot log in", async ({ page, makeUser }) => {
    const user = await makeUser();
    await gotoReady(page, "/login"); // page loaded while the account was still active
    await setActive(user.id, false);
    await login(page, user.displayName, user.password);
    await expect(formMessage(page)).toContainText(INACTIVE);
    await expect(page).toHaveURL(/\/login/);
  });

  test("deactivated while signed in is logged out on the next request (FR-06)", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);

    await setActive(user.id, false);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?reason=inactive/);
    await expect(formMessage(page)).toContainText(INACTIVE);

    // Session was cleared: re-activating does not silently log back in.
    await setActive(user.id, true);
    await page.goto("/board");
    await expect(page).toHaveURL(/\/login/);
  });
});
