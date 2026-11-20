// M3: FR-01, FR-02, FR-03, BR-21..24, BR-26
import { expect, formMessage, gotoReady, login, loginAs, logout, test } from "./fixtures";
import { defaultPassword, setActive } from "./support/users";

const INVALID_CREDENTIALS = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
const INACTIVE = /ถูกปิดการใช้งาน/;
const CHANGE_PASSWORD_URL = /\/change-password$/;
const BOARD_URL = /\/board$/;

test.describe("FR-01 login", () => {
  test("signed-out visitor is sent to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "เข้าสู่ระบบ" })).toBeVisible();
  });

  test("wrong password shows a generic error", async ({ page, makeUser }) => {
    const user = await makeUser();
    await login(page, user.username, "wrong-password");
    await expect(formMessage(page)).toHaveText(INVALID_CREDENTIALS);
    await expect(page).toHaveURL(/\/login/);
  });

  test("unknown or malformed username shows the same error", async ({ page }) => {
    await login(page, "no_such_user_xyz", "whatever");
    await expect(formMessage(page)).toHaveText(INVALID_CREDENTIALS);
    await page.getByLabel("ชื่อผู้ใช้").fill("A!");
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill("whatever");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(formMessage(page)).toHaveText(INVALID_CREDENTIALS);
  });

  test("username is case-insensitive and the internal email is never shown (BR-21/22)", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, { username: `  ${user.username.toUpperCase()} `, password: user.password });
    await expect(page.getByRole("link", { name: user.displayName })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("@kanban.local");
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

test.describe("FR-02 forced password change", () => {
  test("new account must set a new password before using the app", async ({ page, makeUser }) => {
    const user = await makeUser({ mustChangePassword: true });
    await loginAs(page, { username: user.username, password: defaultPassword() }, CHANGE_PASSWORD_URL);

    // Every page leads back here until the password is changed.
    for (const path of ["/board", "/dashboard", "/profile", "/admin"]) {
      await page.goto(path);
      await expect(page).toHaveURL(CHANGE_PASSWORD_URL);
    }
    await gotoReady(page, "/change-password");

    const newPassword = page.getByLabel("รหัสผ่านใหม่", { exact: true });
    const confirm = page.getByLabel("ยืนยันรหัสผ่านใหม่");
    const submit = page.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" });

    // BR-24: default password is rejected.
    await newPassword.fill(defaultPassword());
    await confirm.fill(defaultPassword());
    await submit.click();
    await expect(formMessage(page)).toContainText("ห้ามใช้รหัสผ่านเริ่มต้น");

    // Confirmation must match.
    await newPassword.fill("new-pass-1");
    await confirm.fill("new-pass-2");
    await submit.click();
    await expect(formMessage(page)).toContainText("ไม่ตรงกัน");

    await newPassword.fill("new-pass-1");
    await confirm.fill("new-pass-1");
    await submit.click();
    await expect(page).toHaveURL(BOARD_URL);

    // New password works on the next login; the flag stays cleared.
    await gotoReady(page, "/profile");
    await logout(page);
    await loginAs(page, { username: user.username, password: "new-pass-1" });
  });

  test("change-password page can log out", async ({ page, makeUser }) => {
    const user = await makeUser({ mustChangePassword: true });
    await loginAs(page, { username: user.username, password: defaultPassword() }, CHANGE_PASSWORD_URL);
    await logout(page);
  });
});

test.describe("FR-03 change own password", () => {
  test("requires the current password and accepts a valid change", async ({ page, makeUser }) => {
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
    await loginAs(page, { username: user.username, password: "changed-pass" });
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
    await setActive(user.id, false);
    await login(page, user.username, user.password);
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
