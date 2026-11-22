import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Tests create users with the service role key, so they need .env.local.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// Tests create and delete users, so they must never run against production.
// Same rule as scripts/require-local.mts (inlined: next build type-checks this file).
const supabaseHost = URL.canParse(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname
  : "";
if (process.env.ALLOW_REMOTE_TESTS !== "1" && !["127.0.0.1", "localhost"].includes(supabaseHost)) {
  throw new Error(
    `Refusing to run e2e: NEXT_PUBLIC_SUPABASE_URL is not local (${supabaseHost || "missing"}). Start it with npm run db:start.`,
  );
}

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Every test talks to the same local Supabase stack. Override with E2E_WORKERS.
  workers: Number(process.env.E2E_WORKERS ?? 2),
  reporter: [["list"], ["html", { open: "never" }]],
  // Sign-ins are slow-ish (bcrypt) when many tests log in at once.
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop",
      testIgnore: /.*\.mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
    {
      // Touch / narrow layout checks (FR-08 drag on mobile arrives in M5).
      name: "mobile",
      testMatch: /.*\.mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: "chromium" },
    },
  ],

  // Production build mirrors Vercel. Reuses a server already on the port.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${PORT}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
