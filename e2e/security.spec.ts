// v1.4.0: BR-59 admins must change the default password first; new passwords >= 8;
// security headers on every response.
import { defaultPasswordBanner, expect, formMessage, gotoReady, loginAs, test } from "./fixtures";
import { defaultPassword } from "./support/users";

test("an admin on the default password must change it before using the app", async ({ page, makeUser }) => {
  test.slow();
  const admin = await makeUser({ role: "admin", mustChangePassword: true });
  await loginAs(page, { displayName: admin.displayName, password: defaultPassword() }, /\/profile\?reason=/);
  await expect(page.getByTestId("admin-must-change")).toBeVisible();
  await expect(defaultPasswordBanner(page)).toContainText("ผู้ดูแลระบบต้องเปลี่ยนรหัสผ่านเริ่มต้นก่อนใช้งาน");

  // Every other page sends them back to the profile page.
  for (const path of ["/admin", "/board", "/admin/backup"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/profile\?reason=admin-must-change-password$/);
  }
  // The admin API refuses too.
  const api = await page.request.get("/api/admin/backup");
  expect(api.status()).toBe(403);

  const current = page.getByLabel("รหัสผ่านปัจจุบัน");
  const next = page.getByLabel("รหัสผ่านใหม่", { exact: true });
  const confirm = page.getByLabel("ยืนยันรหัสผ่านใหม่");
  const submit = page.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" });

  // Shorter than 8 is refused (the browser's minlength is bypassed to reach the server rule).
  await next.evaluate((el) => el.removeAttribute("minlength"));
  await confirm.evaluate((el) => el.removeAttribute("minlength"));
  await current.fill(defaultPassword());
  await next.fill("short12");
  await confirm.fill("short12");
  await submit.click();
  await expect(formMessage(page)).toContainText("อย่างน้อย 8 ตัวอักษร");

  await current.fill(defaultPassword());
  await next.fill("admin-pass-2026");
  await confirm.fill("admin-pass-2026");
  await submit.click();
  await expect(formMessage(page)).toContainText("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");

  await gotoReady(page, "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
});

test("a normal user on the default password is still only warned", async ({ page, makeUser }) => {
  const user = await makeUser({ mustChangePassword: true });
  await loginAs(page, { displayName: user.displayName, password: defaultPassword() });
  await expect(page).toHaveURL(/\/board$/);
  await expect(defaultPasswordBanner(page)).toContainText("ควรเปลี่ยนรหัสผ่าน");
});

test("responses carry the security headers", async ({ request }) => {
  const res = await request.get("/login");
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});
