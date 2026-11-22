import { test as base, expect, type Locator, type Page } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  deleteTestUsersByDisplayName,
  randomTestDisplayName,
  type TestUser,
  type TestUserOptions,
} from "./support/users";

type Fixtures = {
  /** Creates a throwaway account; deleted automatically after the test. */
  makeUser: (opts?: TestUserOptions) => Promise<TestUser>;
  /** A fresh unique name (contains "e2e_") for accounts created through the UI; deleted after the test. */
  newDisplayName: () => string;
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
  newDisplayName: async ({}, use) => {
    const names: string[] = [];
    await use(() => {
      const name = randomTestDisplayName();
      names.push(name);
      return name;
    });
    for (const name of names) {
      await deleteTestUsersByDisplayName(name);
    }
  },
});

export { expect };

/** Waits until client JS has loaded so form submits go through React, not a native POST. */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

/** Picks the name from the list and submits (BR-20). Does not wait for the outcome. */
export async function login(page: Page, displayName: string, password: string): Promise<void> {
  if (!page.url().includes("/login")) {
    await page.goto("/login");
  }
  await waitForHydration(page);
  await page.getByLabel("ชื่อผู้ใช้").selectOption({ label: displayName });
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
}

/** Logs in and waits until the app has navigated away from /login. */
export async function loginAs(
  page: Page,
  user: { displayName: string; password: string },
  expected: RegExp = /\/board$/,
): Promise<void> {
  await login(page, user.displayName, user.password);
  await expect(page).toHaveURL(expected, { timeout: 20_000 });
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
export function formMessage(scope: Page | Locator) {
  return scope.locator('[data-slot="alert"]');
}

/** FR-02 warning shown while the account still uses the default password. */
export function defaultPasswordBanner(page: Page) {
  return page.getByTestId("default-password-banner");
}
