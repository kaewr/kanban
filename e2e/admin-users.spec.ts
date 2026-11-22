// M4: FR-04 (create + role), FR-05 (reset password), FR-06 (activate / deactivate), BR-26, BR-27
import type { Browser, Page } from "@playwright/test";
import {
  defaultPasswordBanner,
  expect,
  formMessage,
  gotoReady,
  login,
  loginAs,
  test,
} from "./fixtures";
import { defaultPassword, getProfile } from "./support/users";

const INACTIVE = /ถูกปิดการใช้งาน/;

function userRow(page: Page, username: string) {
  return page.locator(`tr[data-username="${username}"]`);
}

function dialog(page: Page) {
  return page.getByRole("dialog");
}

/** Second, independent browser session (e.g. the managed user). */
async function newSession(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

async function openUsersPage(page: Page): Promise<void> {
  await gotoReady(page, "/admin/users");
  await expect(page.getByRole("heading", { name: "จัดการผู้ใช้" })).toBeVisible();
}

test.describe("FR-04 create user", () => {
  test("admin creates a user who can log in with the default password and sees the warning", async ({
    page,
    browser,
    makeUser,
    newUsername,
  }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const username = newUsername();

    await loginAs(page, admin);
    await page.getByRole("navigation").getByRole("link", { name: "Admin" }).click();
    await page.getByRole("link", { name: /จัดการผู้ใช้/ }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
    await dialog(page).getByLabel("ชื่อผู้ใช้").fill(username.toUpperCase()); // stored lower-case (BR-22)
    await dialog(page).getByLabel("ชื่อที่แสดง").fill("พนักงาน ทดสอบ");
    await dialog(page).getByLabel("บทบาท").selectOption("user");
    await dialog(page).getByRole("button", { name: "สร้างผู้ใช้" }).click();
    await expect(dialog(page)).toHaveCount(0);

    const row = userRow(page, username);
    await expect(row).toContainText("พนักงาน ทดสอบ");
    await expect(row).toContainText("ผู้ใช้งาน");
    await expect(row).toContainText("ยังใช้รหัสผ่านเริ่มต้น");

    const profile = await getProfile(username);
    expect(profile).toMatchObject({ role: "user", is_active: true, must_change_password: true });

    // FR-04 acceptance: new user logs in with the default password right away.
    const userPage = await newSession(browser);
    await loginAs(userPage, { username, password: defaultPassword() });
    await expect(defaultPasswordBanner(userPage)).toBeVisible();
    await expect(userPage.getByRole("navigation").getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("duplicate username is rejected", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    const existing = await makeUser();

    await loginAs(page, admin);
    await openUsersPage(page);
    await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
    await dialog(page).getByLabel("ชื่อผู้ใช้").fill(existing.username);
    await dialog(page).getByLabel("ชื่อที่แสดง").fill("ซ้ำ");
    await dialog(page).getByRole("button", { name: "สร้างผู้ใช้" }).click();
    await expect(formMessage(dialog(page))).toHaveText("ชื่อผู้ใช้นี้มีอยู่แล้ว");
  });

  test("API validates username, display name and role", async ({ page, makeUser, newUsername }) => {
    const admin = await makeUser({ role: "admin" });
    await loginAs(page, admin);

    const post = (data: Record<string, unknown>) => page.request.post("/api/admin/users", { data });

    let res = await post({ username: "ab", displayName: "x", role: "user" });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("3–30");

    res = await post({ username: "bad name!", displayName: "x", role: "user" });
    expect(res.status()).toBe(400);

    res = await post({ username: newUsername(), displayName: "   ", role: "user" });
    expect(res.status()).toBe(400);

    res = await post({ username: newUsername(), displayName: "x", role: "superuser" });
    expect(res.status()).toBe(400);
  });

  test("admin can create another admin", async ({ page, browser, makeUser, newUsername }) => {
    const admin = await makeUser({ role: "admin" });
    const username = newUsername();
    await loginAs(page, admin);

    const res = await page.request.post("/api/admin/users", {
      data: { username, displayName: "แอดมินใหม่", role: "admin" },
    });
    expect(res.status()).toBe(201);

    const other = await newSession(browser);
    await loginAs(other, { username, password: defaultPassword() });
    await expect(other.getByRole("navigation").getByRole("link", { name: "Admin" })).toBeVisible();
  });
});

test.describe("role and display name", () => {
  test("promote to admin and demote back changes the menu", async ({ page, browser, makeUser }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();

    const userPage = await newSession(browser);
    await loginAs(userPage, user);
    await expect(userPage.getByRole("navigation").getByRole("link", { name: "Admin" })).toHaveCount(0);

    await loginAs(page, admin);
    await openUsersPage(page);
    await page.getByRole("button", { name: `แก้ไข ${user.username}` }).click();
    await dialog(page).getByLabel("ชื่อที่แสดง").fill("ชื่อใหม่");
    await dialog(page).getByLabel("บทบาท").selectOption("admin");
    await dialog(page).getByRole("button", { name: "บันทึก" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(userRow(page, user.username)).toContainText("ชื่อใหม่");
    await expect(userRow(page, user.username)).toContainText("ผู้ดูแลระบบ");

    await gotoReady(userPage, "/board");
    await expect(userPage.getByRole("navigation").getByRole("link", { name: "Admin" })).toBeVisible();
    await expect(userPage.getByRole("link", { name: "ชื่อใหม่" })).toBeVisible();

    await page.getByRole("button", { name: `แก้ไข ${user.username}` }).click();
    await dialog(page).getByLabel("บทบาท").selectOption("user");
    await dialog(page).getByRole("button", { name: "บันทึก" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await gotoReady(userPage, "/admin");
    await expect(userPage).toHaveURL(/\/board$/);
  });
});

test.describe("FR-05 reset password", () => {
  test("reset returns the account to the default password with the warning", async ({ page, browser, makeUser }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();

    await loginAs(page, admin);
    await openUsersPage(page);
    await expect(userRow(page, user.username)).not.toContainText("ยังใช้รหัสผ่านเริ่มต้น");

    await page.getByRole("button", { name: `รีเซ็ตรหัสผ่าน ${user.username}` }).click();
    await dialog(page).getByRole("button", { name: "รีเซ็ตรหัสผ่าน" }).click();
    await expect(formMessage(dialog(page))).toContainText("รีเซ็ตรหัสผ่านเรียบร้อยแล้ว");
    await dialog(page).getByRole("button", { name: "ปิด" }).last().click();
    await expect(userRow(page, user.username)).toContainText("ยังใช้รหัสผ่านเริ่มต้น");

    const userPage = await newSession(browser);
    await login(userPage, user.username, user.password);
    await expect(formMessage(userPage)).toHaveText("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");

    await loginAs(userPage, { username: user.username, password: defaultPassword() });
    await expect(defaultPasswordBanner(userPage)).toBeVisible();
  });
});

test.describe("FR-06 activate / deactivate", () => {
  test("deactivating logs the user out, blocks login; reactivating restores access", async ({
    page,
    browser,
    makeUser,
  }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();

    const userPage = await newSession(browser);
    await loginAs(userPage, user);

    await loginAs(page, admin);
    await openUsersPage(page);
    await page.getByRole("button", { name: `ปิดการใช้งาน ${user.username}` }).click();
    await dialog(page).getByRole("button", { name: "ปิดการใช้งาน" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(userRow(page, user.username)).toContainText("ปิดใช้งาน");

    // FR-06 acceptance: the open session is rejected on the next request.
    await userPage.goto("/dashboard");
    await expect(userPage).toHaveURL(/\/login\?reason=inactive/);

    // Banned in Supabase Auth too: login shows the inactive message.
    await login(userPage, user.username, user.password);
    await expect(formMessage(userPage).last()).toContainText(INACTIVE);
    await expect(userPage).toHaveURL(/\/login/);

    await page.getByRole("button", { name: `เปิดการใช้งาน ${user.username}` }).click();
    await dialog(page).getByRole("button", { name: "เปิดการใช้งาน" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(userRow(page, user.username).getByText("ใช้งาน", { exact: true })).toBeVisible();

    await gotoReady(userPage, "/login");
    await loginAs(userPage, user);
  });
});

test.describe("BR-27 and API protection", () => {
  test("admin cannot demote, deactivate or reset their own account", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    await loginAs(page, admin);
    await openUsersPage(page);

    const row = userRow(page, admin.username);
    await expect(row).toContainText("(คุณ)");
    await expect(row.getByRole("button", { name: /รีเซ็ตรหัสผ่าน/ })).toHaveCount(0);
    await expect(row.getByRole("button", { name: /ปิดการใช้งาน/ })).toHaveCount(0);
    await row.getByRole("button", { name: /แก้ไข/ }).click();
    await expect(dialog(page).getByLabel("บทบาท")).toBeDisabled();

    let res = await page.request.patch(`/api/admin/users/${admin.id}`, { data: { isActive: false } });
    expect(res.status()).toBe(400);
    res = await page.request.patch(`/api/admin/users/${admin.id}`, { data: { role: "user" } });
    expect(res.status()).toBe(400);
    res = await page.request.post(`/api/admin/users/${admin.id}/reset-password`);
    expect(res.status()).toBe(400);

    expect(await getProfile(admin.username)).toMatchObject({ role: "admin", is_active: true });
  });

  test("non-admin gets 403 and signed-out gets 401 from admin APIs", async ({ page, makeUser }) => {
    const user = await makeUser();
    const victim = await makeUser();

    let res = await page.request.post("/api/admin/users", {
      data: { username: "e2e_nope", displayName: "x", role: "admin" },
    });
    expect(res.status()).toBe(401);

    await loginAs(page, user);
    res = await page.request.post("/api/admin/users", {
      data: { username: "e2e_nope", displayName: "x", role: "admin" },
    });
    expect(res.status()).toBe(403);
    res = await page.request.patch(`/api/admin/users/${user.id}`, { data: { role: "admin" } });
    expect(res.status()).toBe(403);
    res = await page.request.patch(`/api/admin/users/${victim.id}`, { data: { isActive: false } });
    expect(res.status()).toBe(403);
    res = await page.request.post(`/api/admin/users/${victim.id}/reset-password`);
    expect(res.status()).toBe(403);

    expect(await getProfile(user.username)).toMatchObject({ role: "user" });
    expect(await getProfile(victim.username)).toMatchObject({ is_active: true });
    expect(await getProfile("e2e_nope")).toBeNull();
  });

  test("non-admin cannot open the users page", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/board$/);
  });
});
