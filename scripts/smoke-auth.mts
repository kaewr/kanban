// Smoke test for the auth proxy (M3) against a running server.
// Creates temporary users (smoke_*), builds real @supabase/ssr session cookies,
// requests pages over HTTP and checks redirects. Cleans up afterwards.
//
// Usage: start the app (npm run build && npm run start), then
//        npm run test:smoke-auth            (BASE_URL defaults to http://localhost:3000)
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env ${name} (check .env.local)`);
    process.exit(1);
  }
  return value;
}

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

const service = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PREFIX = "smoke_";
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function cleanup(): Promise<void> {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email?.startsWith(PREFIX)) {
      await service.from("profiles").update({ role: "user" }).eq("id", user.id);
      await service.auth.admin.deleteUser(user.id);
    }
  }
}

type SmokeUser = { id: string; cookie: string };

async function createUser(
  suffix: string,
  opts: { role: "user" | "admin"; mustChange: boolean },
): Promise<SmokeUser> {
  const username = `${PREFIX}${suffix}`;
  const email = `${username}@kanban.local`;
  const password = randomUUID();

  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw new Error(`createUser ${username}: ${created.error.message}`);
  const id = created.data.user.id;

  const inserted = await service.from("profiles").insert({
    id,
    username,
    display_name: `ทดสอบ ${suffix}`,
    role: opts.role,
    must_change_password: opts.mustChange,
  });
  if (inserted.error) throw new Error(`insert profile ${username}: ${inserted.error.message}`);

  // Let @supabase/ssr produce exactly the cookies the browser would hold.
  const jar = new Map<string, string>();
  const ssr = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const signIn = await ssr.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn ${username}: ${signIn.error.message}`);

  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  return { id, cookie };
}

async function get(path: string, cookie?: string): Promise<{ status: number; location: string; body: string }> {
  const res = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location") ?? "", body };
}

function redirectsTo(res: { status: number; location: string }, path: string): boolean {
  if (res.status < 300 || res.status >= 400) return false;
  const target = new URL(res.location, baseUrl);
  return `${target.pathname}${target.search}` === path || target.pathname === path;
}

async function main(): Promise<void> {
  try {
    await fetch(baseUrl, { redirect: "manual" });
  } catch {
    throw new Error(`Server not reachable at ${baseUrl}. Start it first (npm run start).`);
  }

  await cleanup();

  console.log("\nSigned out");
  {
    const login = await get("/login");
    check("/login is public (200)", login.status === 200, `status ${login.status}`);
    const root = await get("/");
    check("/ redirects to /board", redirectsTo(root, "/board"), root.location);
    const board = await get("/board");
    check("/board -> /login?next=%2Fboard", redirectsTo(board, "/login?next=%2Fboard"), board.location);
    const profile = await get("/profile");
    check("/profile -> /login", redirectsTo(profile, "/login"), profile.location);
  }

  const fresh = await createUser("fresh", { role: "user", mustChange: true });
  const user = await createUser("user", { role: "user", mustChange: false });
  const admin = await createUser("admin", { role: "admin", mustChange: false });

  console.log("\nmust_change_password = true (FR-02: warning only)");
  for (const path of ["/board", "/dashboard", "/profile"]) {
    const res = await get(path, fresh.cookie);
    check(`${path} 200 (not blocked)`, res.status === 200, `${res.status} ${res.location}`);
    check(`${path} shows the default-password banner`, res.body.includes("default-password-banner"));
  }
  {
    const res = await get("/change-password", fresh.cookie);
    check("/change-password -> /profile", redirectsTo(res, "/profile"), `${res.status} ${res.location}`);
  }

  console.log("\nActive user");
  {
    const board = await get("/board", user.cookie);
    check("/board 200", board.status === 200, `status ${board.status}`);
    check("menu has บอร์ด and Dashboard", board.body.includes("บอร์ด") && board.body.includes("Dashboard"));
    check("menu hides Admin for user", !board.body.includes('href="/admin"'));
    check("internal email not shown", !board.body.includes("@kanban.local"));
    const login = await get("/login", user.cookie);
    check("/login -> /board when signed in", redirectsTo(login, "/board"), login.location);
    check("no default-password banner", !board.body.includes("default-password-banner"));
    const adminPage = await get("/admin", user.cookie);
    const blocked = redirectsTo(adminPage, "/board") || (adminPage.status === 200 && adminPage.body.includes("NEXT_REDIRECT"));
    check("/admin blocked for user", blocked, `status ${adminPage.status}`);
  }

  console.log("\nAdmin");
  {
    const board = await get("/board", admin.cookie);
    check("menu shows Admin for admin", board.body.includes('href="/admin"'));
    const adminPage = await get("/admin", admin.cookie);
    check("/admin 200 for admin", adminPage.status === 200 && !adminPage.body.includes("NEXT_REDIRECT"), `status ${adminPage.status}`);
  }

  console.log("\nDeactivated while signed in (BR-26 / FR-06)");
  {
    await service.from("profiles").update({ is_active: false }).eq("id", user.id);
    const res = await get("/board", user.cookie);
    check("/board -> /login?reason=inactive", redirectsTo(res, "/login?reason=inactive"), `${res.status} ${res.location}`);
  }
}

main()
  .catch((error: unknown) => {
    failed++;
    console.error(`\nAborted: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
  })
  .finally(async () => {
    await cleanup();
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
