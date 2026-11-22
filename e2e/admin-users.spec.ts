// M4: FR-04 (create + role), FR-05 (reset password), FR-06 (activate / deactivate), BR-26, BR-27
// Since 22 Nov 2026: unit (BR-29), position (BR-30), generated usernames and login by name (BR-20).
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
import { defaultPassword, getProfile, getProfileByName } from "./support/users";

const INACTIVE = /ถูกปิดการใช้งาน/;

function userRow(page: Page, username: string) {
  return page.locator(`tr[data-username="${username}"]`);
}

function rowByName(page: Page, displayName: string) {
  return page.locator("tr", { hasText: displayName });
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
  test("admin creates a user with unit and position; they log in by picking their name", async ({
    page,
    browser,
    makeUser,
    newDisplayName,
  }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const name = newDisplayName();

    await loginAs(page, admin);
    await page.getByRole("navigation").getByRole("link", { name: "Admin" }).click();
    await page.getByRole("link", { name: /จัดการผู้ใช้/ }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
    await expect(dialog(page).getByLabel("ชื่อผู้ใช้")).toHaveCount(0); // generated, not typed
    await dialog(page).getByLabel("ชื่อ-นามสกุล").fill(name);
    await dialog(page).getByLabel("สังกัดงาน").selectOption({ label: "งานแผนงาน" });
    await dialog(page).getByLabel("ตำแหน่ง").fill("นักวิเคราะห์นโยบายและแผน");
    await dialog(page).getByLabel("บทบาท").selectOption("user");
    await dialog(page).getByRole("button", { name: "สร้างผู้ใช้" }).click();
    await expect(dialog(page)).toHaveCount(0);

    const row = rowByName(page, name);
    await expect(row).toContainText("งานแผนงาน");
    await expect(row).toContainText("นักวิเคราะห์นโยบายและแผน");
    await expect(row).toContainText("ยังใช้รหัสผ่านเริ่มต้น");

    const profile = await getProfileByName(name);
    expect(profile).toMatchObject({
      role: "user",
      is_active: true,
      must_change_password: true,
      unit_id: "planning",
      position: "นักวิเคราะห์นโยบายและแผน",
      year_type: "fiscal",
    });
    expect(profile?.username).toMatch(/^u_[0-9a-f]{8}$/);

    // Unit filter.
    await page.getByLabel("กรองตามสังกัดงาน").selectOption("planning");
    await expect(page).toHaveURL(/unit=planning/);
    await expect(rowByName(page, name)).toBeVisible();
    await expect(userRow(page, admin.username)).toHaveCount(0);

    // FR-04 acceptance: the new user logs in with the default password right away.
    const userPage = await newSession(browser);
    await loginAs(userPage, { displayName: name, password: defaultPassword() });
    await expect(defaultPasswordBanner(userPage)).toBeVisible();
    await expect(userPage.getByRole("navigation").getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("a name already used by an active account is rejected", async ({ page, makeUser }) => {
    const admin = await makeUser({ role: "admin" });
    const existing = await makeUser();

    await loginAs(page, admin);
    await openUsersPage(page);
    await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
    await dialog(page).getByLabel("ชื่อ-นามสกุล").fill(existing.displayName);
    await dialog(page).getByLabel("สังกัดงาน").selectOption("academic");
    await dialog(page).getByRole("button", { name: "สร้างผู้ใช้" }).click();
    await expect(formMessage(dialog(page))).toHaveText("มีผู้ใช้ชื่อนี้อยู่แล้ว");
  });

  test("API validates name, unit, position and role", async ({ page, makeUser, newDisplayName }) => {
    const admin = await makeUser({ role: "admin" });
    await loginAs(page, admin);

    const post = (data: Record<string, unknown>) => page.request.post("/api/admin/users", { data });
    const valid = { displayName: newDisplayName(), unitId: "academic", role: "user" };

    let res = await post({ ...valid, displayName: "   " });
    expect(res.status()).toBe(400);
    res = await post({ ...valid, unitId: undefined });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("กรุณาเลือกสังกัดงาน");
    res = await post({ ...valid, unitId: "finance" });
    expect(res.status()).toBe(400);
    res = await post({ ...valid, position: "ก".repeat(101) });
    expect(res.status()).toBe(400);
    res = await post({ ...valid, role: "superuser" });
    expect(res.status()).toBe(400);
    expect(await getProfileByName(valid.displayName)).toBeNull();
  });

  test("admin can create another admin", async ({ page, browser, makeUser, newDisplayName }) => {
    const admin = await makeUser({ role: "admin" });
    const name = newDisplayName();
    await loginAs(page, admin);

    const res = await page.request.post("/api/admin/users", {
      data: { displayName: name, unitId: "administration", role: "admin" },
    });
    expect(res.status()).toBe(201);

    const other = await newSession(browser);
    await loginAs(other, { displayName: name, password: defaultPassword() });
    await expect(other.getByRole("navigation").getByRole("link", { name: "Admin" })).toBeVisible();
  });
});

test.describe("role, name, unit and position", () => {
  test("admin edits unit and position; promote to admin and demote back changes the menu", async ({
    page,
    browser,
    makeUser,
    newDisplayName,
  }) => {
    test.slow();
    const admin = await makeUser({ role: "admin" });
    const user = await makeUser();

    const userPage = await newSession(browser);
    await loginAs(userPage, user);
    await expect(userPage.getByRole("navigation").getByRole("link", { name: "Admin" })).toHaveCount(0);

    await loginAs(page, admin);
    await openUsersPage(page);
    const newName = newDisplayName();
    await page.getByRole("button", { name: `แก้ไข ${user.displayName}` }).click();
    await dialog(page).getByLabel("ชื่อ-นามสกุล").fill(newName);
    await dialog(page).getByLabel("สังกัดงาน").selectOption("digital_skills");
    await dialog(page).getByLabel("ตำแหน่ง").fill("นักวิชาการคอมพิวเตอร์");
    await dialog(page).getByLabel("บทบาท").selectOption("admin");
    await dialog(page).getByRole("button", { name: "บันทึก" }).click();
    await expect(dialog(page)).toHaveCount(0);
    const row = userRow(page, user.username);
    await expect(row).toContainText(newName);
    await expect(row).toContainText("งานพัฒนาทักษะดิจิทัล");
    await expect(row).toContainText("นักวิชาการคอมพิวเตอร์");
    await expect(row).toContainText("ผู้ดูแลระบบ");

    await gotoReady(userPage, "/profile");
    await expect(userPage.getByTestId("profile-org")).toContainText("นักวิชาการคอมพิวเตอร์");
    await expect(userPage.getByTestId("profile-org")).toContainText("งานพัฒนาทักษะดิจิทัล");
    await expect(userPage.getByRole("navigation").getByRole("link", { name: "Admin" })).toBeVisible();
    await expect(userPage.getByRole("link", { name: newName })).toBeVisible();

    await page.getByRole("button", { name: `แก้ไข ${newName}` }).click();
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

    await page.getByRole("button", { name: `รีเซ็ตรหัสผ่าน ${user.displayName}` }).click();
    await dialog(page).getByRole("button", { name: "รีเซ็ตรหัสผ่าน" }).click();
    await expect(formMessage(dialog(page))).toContainText("รีเซ็ตรหัสผ่านเรียบร้อยแล้ว");
    await dialog(page).getByRole("button", { name: "ปิด" }).last().click();
    await expect(userRow(page, user.username)).toContainText("ยังใช้รหัสผ่านเริ่มต้น");

    const userPage = await newSession(browser);
    await login(userPage, user.displayName, user.password);
    await expect(formMessage(userPage)).toHaveText("รหัสผ่านไม่ถูกต้อง");

    await loginAs(userPage, { displayName: user.displayName, password: defaultPassword() });
    await expect(defaultPasswordBanner(userPage)).toBeVisible();
  });
});

test.describe("FR-06 activate / deactivate", () => {
  test("deactivating logs the user out and hides them from login; reactivating restores access", async ({
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
    await page.getByRole("button", { name: `ปิดการใช้งาน ${user.displayName}` }).click();
    await dialog(page).getByRole("button", { name: "ปิดการใช้งาน" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(userRow(page, user.username)).toContainText("ปิดใช้งาน");

    // FR-06 acceptance: the open session is rejected on the next request.
    await userPage.goto("/dashboard");
    await expect(userPage).toHaveURL(/\/login\?reason=inactive/);
    await expect(formMessage(userPage).last()).toContainText(INACTIVE);
    // Inactive accounts are not offered on the login page (BR-20, BR-26).
    await expect(userPage.getByLabel("ชื่อผู้ใช้").locator("option", { hasText: user.displayName })).toHaveCount(0);

    await page.getByRole("button", { name: `เปิดการใช้งาน ${user.displayName}` }).click();
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

    const nope = { displayName: "ทดสอบ e2e_nope", unitId: "academic", role: "admin" };
    let res = await page.request.post("/api/admin/users", { data: nope });
    expect(res.status()).toBe(401);

    await loginAs(page, user);
    res = await page.request.post("/api/admin/users", { data: nope });
    expect(res.status()).toBe(403);
    res = await page.request.patch(`/api/admin/users/${user.id}`, { data: { role: "admin" } });
    expect(res.status()).toBe(403);
    res = await page.request.patch(`/api/admin/users/${user.id}`, { data: { position: "หัวหน้า" } });
    expect(res.status()).toBe(403); // BR-30: users cannot change their own position
    res = await page.request.patch(`/api/admin/users/${victim.id}`, { data: { isActive: false } });
    expect(res.status()).toBe(403);
    res = await page.request.post(`/api/admin/users/${victim.id}/reset-password`);
    expect(res.status()).toBe(403);

    expect(await getProfile(user.username)).toMatchObject({ role: "user" });
    expect(await getProfile(victim.username)).toMatchObject({ is_active: true });
    expect(await getProfileByName(nope.displayName)).toBeNull();
  });

  test("non-admin cannot open the users page", async ({ page, makeUser }) => {
    const user = await makeUser();
    await loginAs(page, user);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/board$/);
  });
});
