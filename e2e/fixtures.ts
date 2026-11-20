import { test as base, expect, type Page } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  type TestUser,
  type TestUserOptions,
} from "./support/users";

type Fixtures = {
  /** Creates a throwaway account; deleted automatically after the test. */
  makeUser: (opts?: TestUserOptions) => Promise<TestUser>;
};

export const test = base.extend<Fixtures>({
  makeUser: async ({}, use) => {
    const created: TestUser[] = [];
    await use(async (opts) => {
      const user = await createTestUser(opts);
      created.push(user);
      return user;
    });
    for (const user of created) {
      await deleteTestUser(user.id);
    }
  },
});

export { expect };

/** Waits until client JS has loaded so form submits go through React, not a native POST. */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

/** Submits the login form. Does not wait for the outcome (use for failure cases). */
export async function login(page: Page, username: string, password: string): Promise<void> {
  if (!page.url().includes("/login")) {
    await page.goto("/login");
  }
  await waitForHydration(page);
  await page.getByLabel("ชื่อผู้ใช้").fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
}

/** Logs in and waits until the app has navigated away from /login. */
export async function loginAs(
  page: Page,
  user: { username: string; password: string },
  expected: RegExp = /\/board$/,
): Promise<void> {
  await login(page, user.username, user.password);
  await expect(page).toHaveURL(expected);
  await waitForHydration(page);
}

export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForHydration(page);
}

export async function logout(page: Page): Promise<void> {
  await waitForHydration(page);
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** The form's Alert (error or success). Avoids Next.js's route announcer, which also has role="alert". */
export function formMessage(page: Page) {
  return page.locator('[data-slot="alert"]');
}
