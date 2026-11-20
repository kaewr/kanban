// Mobile viewport (Pixel 7, touch). Board drag & drop checks arrive in M5 (FR-08).
import { expect, loginAs, test } from "./fixtures";

test("login and menu work on a phone without horizontal page scroll", async ({ page, makeUser }) => {
  const user = await makeUser();
  await loginAs(page, user);
  await expect(page.getByRole("navigation").getByRole("link", { name: "บอร์ด" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
