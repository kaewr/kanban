// Version footer on every page (incl. /login) and the release notes page.
import { readFileSync } from "node:fs";
import { expect, loginAs, test } from "./fixtures";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

test("the version shows on the login page and in the app, and links to the release notes", async ({ page, makeUser }) => {
  const user = await makeUser(); // before /login loads its name list
  await page.goto("/login");
  await expect(page.getByTestId("app-version")).toHaveText(`เวอร์ชัน ${version}`);
  await expect(page.getByTestId("app-footer")).toContainText(/· [0-9a-f]{7}|· local/);

  await loginAs(page, user);
  // cacheComponents keeps the previous route (the login page) hidden in the DOM.
  const link = page.getByTestId("app-version").filter({ visible: true });
  await expect(link).toHaveText(`เวอร์ชัน ${version}`);

  await link.click();
  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.getByRole("heading", { name: "มีอะไรใหม่" })).toBeVisible();
  const current = page.locator(`[data-version="${version}"]`);
  await expect(current).toContainText("ปัจจุบัน");
  await expect(page.locator("[data-version]").first()).toHaveAttribute("data-version", version);
});
