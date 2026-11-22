// Light / dark mode: light by default, the choice is remembered.
import { expect, gotoReady, loginAs, test } from "./fixtures";

test("light by default; dark mode is remembered across pages and reloads", async ({ page, makeUser }) => {
  const user = await makeUser();
  await gotoReady(page, "/login");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  await loginAs(page, user);
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "เปลี่ยนเป็นโหมดมืด" }).click();
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await gotoReady(page, "/profile");
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: "เปลี่ยนเป็นโหมดสว่าง" }).click();
  await expect(html).not.toHaveClass(/dark/);
  await page.reload();
  await expect(html).not.toHaveClass(/dark/);
});
