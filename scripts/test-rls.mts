// RLS test against the local Supabase stack (npm run db:start).
// Creates temporary users rls_test_a, rls_test_b (user) and rls_test_admin (admin),
// signs in as each with the publishable key, checks access rules, then cleans up.
// Requires the real admin to exist first (npm run db:create-admin) because of BR-27.
//
// Usage: npm run db:test-rls
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { assertLocalSupabase } from "./require-local.mts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env ${name} (check .env.local)`);
    process.exit(1);
  }
  return value;
}

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
assertLocalSupabase(url);
const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceRoleKey, clientOptions);

const TEST_PREFIX = "rls_test_";
const YEAR = 2569;

type TestUser = { id: string; username: string; client: SupabaseClient };

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

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): NonNullable<T> {
  if (result.error || result.data === null) {
    throw new Error(`${what}: ${result.error?.message ?? "no data"}`);
  }
  return result.data as NonNullable<T>;
}

async function cleanup(): Promise<void> {
  const { data: profiles } = await service
    .from("profiles")
    .select("id")
    .like("username", `${TEST_PREFIX}%`);
  const ids = (profiles ?? []).map((p: { id: string }) => p.id);

  if (ids.length > 0) {
    const { data: tasks } = await service.from("tasks").select("id").in("owner_id", ids);
    const taskIds = (tasks ?? []).map((t: { id: string }) => t.id);
    await service.from("leaves").delete().in("owner_id", ids);
    await service.from("leaves").delete().in("created_by", ids);
    await service.from("task_history").delete().in("changed_by", ids);
    if (taskIds.length > 0) {
      await service.from("task_history").delete().in("task_id", taskIds);
      await service.from("tasks").delete().in("id", taskIds);
    }
  }

  // Also catch auth users whose profile insert failed in an earlier run.
  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const user of list?.users ?? []) {
    if (user.email?.startsWith(TEST_PREFIX)) {
      // Demote first so deleting never trips BR-27.
      await service.from("profiles").update({ role: "user" }).eq("id", user.id);
      await service.auth.admin.deleteUser(user.id);
    }
  }
}

async function createTestUser(suffix: string, role: "user" | "admin"): Promise<TestUser> {
  const username = `${TEST_PREFIX}${suffix}`;
  const password = randomUUID();
  const created = await service.auth.admin.createUser({
    email: `${username}@kanban.local`,
    password,
    email_confirm: true,
  });
  if (created.error) throw new Error(`createUser ${username}: ${created.error.message}`);
  const id = created.data.user.id;

  const inserted = await service.from("profiles").insert({
    id,
    username,
    display_name: username,
    role,
    must_change_password: false,
  });
  if (inserted.error) throw new Error(`insert profile ${username}: ${inserted.error.message}`);

  const client = createClient(url, publishableKey, clientOptions);
  const signIn = await client.auth.signInWithPassword({
    email: `${username}@kanban.local`,
    password,
  });
  if (signIn.error) throw new Error(`signIn ${username}: ${signIn.error.message}`);

  return { id, username, client };
}

async function insertTaskAsService(ownerId: string, categoryId: string, title: string): Promise<string> {
  const row = must(
    await service
      .from("tasks")
      .insert({ owner_id: ownerId, title, status: "short_term", category_id: categoryId, year: YEAR })
      .select("id")
      .single(),
    `insert task ${title}`,
  );
  return (row as { id: string }).id;
}

async function main(): Promise<void> {
  console.log("Cleaning up leftovers from previous runs...");
  await cleanup();

  const realAdmins = must(
    await service
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true)
      .not("username", "like", `${TEST_PREFIX}%`),
    "check real admin",
  );
  if ((realAdmins as unknown[]).length === 0) {
    throw new Error("No active admin found. Run `npm run db:create-admin` first.");
  }

  const category = must(
    await service.from("categories").select("id").order("sort_order").limit(1).single(),
    "load category",
  ) as { id: string };

  console.log("Creating test users...");
  const a = await createTestUser("a", "user");
  const b = await createTestUser("b", "user");
  const admin = await createTestUser("admin", "admin");

  const taskA = await insertTaskAsService(a.id, category.id, "งานของ A");
  const taskB = await insertTaskAsService(b.id, category.id, "งานของ B");
  must(
    await service.from("task_history").insert({ task_id: taskB, to_status: "short_term", changed_by: b.id }).select("id"),
    "seed history B",
  );

  // ------------------------------------------------------------------ user A
  console.log("\nUser A (active user)");
  {
    const c = a.client;

    const tasks = await c.from("tasks").select("id, owner_id");
    const rows = (tasks.data ?? []) as { id: string; owner_id: string }[];
    check("A sees own task", rows.some((t) => t.id === taskA));
    check("A cannot see B's task", !rows.some((t) => t.owner_id === b.id), tasks.error?.message);

    const updB = await c.from("tasks").update({ title: "hacked" }).eq("id", taskB).select("id");
    const afterB = must(await service.from("tasks").select("title").eq("id", taskB).single(), "reload B") as { title: string };
    check("A cannot update B's task", (updB.data ?? []).length === 0 && afterB.title === "งานของ B");

    const insForB = await c
      .from("tasks")
      .insert({ owner_id: b.id, title: "spoof", status: "short_term", category_id: category.id, year: YEAR });
    check("A cannot create a task owned by B", insForB.error !== null);

    const insOwn = await c
      .from("tasks")
      .insert({ owner_id: a.id, title: "งานใหม่ A", status: "in_progress", category_id: category.id, year: YEAR })
      .select("id");
    check("A can create own task", insOwn.error === null && (insOwn.data ?? []).length === 1, insOwn.error?.message);

    const updOwn = await c.from("tasks").update({ title: "งานของ A (แก้)" }).eq("id", taskA).select("id");
    check("A can update own task", (updOwn.data ?? []).length === 1, updOwn.error?.message);

    const moveToB = await c.from("tasks").update({ owner_id: b.id }).eq("id", taskA).select("id");
    check("A cannot hand own task to B", moveToB.error !== null || (moveToB.data ?? []).length === 0);

    await c.from("tasks").delete().eq("id", taskA);
    const stillThere = await service.from("tasks").select("id").eq("id", taskA);
    check("A cannot hard-delete own task (soft delete only)", (stillThere.data ?? []).length === 1);

    const profiles = await c.from("profiles").select("id");
    const pRows = (profiles.data ?? []) as { id: string }[];
    check("A reads only own profile", pRows.length === 1 && pRows[0]?.id === a.id, profiles.error?.message);

    const roleUpd = await c.from("profiles").update({ role: "admin" }).eq("id", a.id).select("id");
    const roleNow = must(await service.from("profiles").select("role").eq("id", a.id).single(), "reload A role") as { role: string };
    check("A cannot change own role", (roleUpd.error !== null || (roleUpd.data ?? []).length === 0) && roleNow.role === "user");

    const flagUpd = await c.from("profiles").update({ must_change_password: false, is_active: true }).eq("id", a.id).select("id");
    check("A cannot update own profile at all", flagUpd.error !== null || (flagUpd.data ?? []).length === 0);

    const histB = await c.from("task_history").select("id").eq("task_id", taskB);
    check("A cannot read B's task history", (histB.data ?? []).length === 0);

    const histInsB = await c.from("task_history").insert({ task_id: taskB, to_status: "done", changed_by: a.id });
    check("A cannot write history for B's task", histInsB.error !== null);

    const histSpoof = await c.from("task_history").insert({ task_id: taskA, to_status: "in_progress", changed_by: b.id });
    check("A cannot write history as someone else", histSpoof.error !== null);

    const histOwn = await c.from("task_history").insert({ task_id: taskA, to_status: "in_progress", changed_by: a.id });
    check("A can write history for own task", histOwn.error === null, histOwn.error?.message);

    const cats = await c.from("categories").select("id");
    check("A can read categories", (cats.data ?? []).length >= 4, cats.error?.message);

    const catIns = await c.from("categories").insert({ name: "rls_test_category" });
    check("A cannot create categories", catIns.error !== null);

    const settings = await c.from("app_settings").select("fiscal_start_month");
    check("A can read app_settings", (settings.data ?? []).length === 1, settings.error?.message);

    const setUpd = await c.from("app_settings").update({ fiscal_start_month: 1 }).eq("id", true).select("id");
    check("A cannot update app_settings", setUpd.error !== null || (setUpd.data ?? []).length === 0);

    const reorder = await c.rpc("reorder_categories", { p_ids: (cats.data ?? []).map((r) => r.id) });
    check("A cannot reorder categories (FR-18)", reorder.error !== null);

    // BR-40..44 leaves
    const ownLeave = await c
      .from("leaves")
      .insert({ owner_id: a.id, created_by: a.id, leave_type: "sick", start_date: "2026-11-23", end_date: "2026-11-24" })
      .select("id");
    check("A can record own leave", (ownLeave.data ?? []).length === 1, ownLeave.error?.message);
    const overlap = await c
      .from("leaves")
      .insert({ owner_id: a.id, created_by: a.id, leave_type: "personal", start_date: "2026-11-24", end_date: "2026-11-25" });
    check("A cannot record an overlapping leave", overlap.error !== null);
    const forB = await c
      .from("leaves")
      .insert({ owner_id: b.id, created_by: a.id, leave_type: "sick", start_date: "2026-11-23", end_date: "2026-11-23" });
    check("A cannot record leave for B", forB.error !== null);
    const spoof = await c
      .from("leaves")
      .insert({ owner_id: a.id, created_by: b.id, leave_type: "sick", start_date: "2026-12-01", end_date: "2026-12-01" });
    check("A cannot record leave as someone else", spoof.error !== null);
    const leaveDel = await c.from("leaves").delete().eq("owner_id", a.id).select("id");
    check("A cannot hard-delete leaves", leaveDel.error !== null || (leaveDel.data ?? []).length === 0);
    const leaveSum = await c.rpc("leave_summary", { p_from: "2026-10-01", p_to: "2027-09-30", p_owner_id: a.id });
    const sumRows = (leaveSum.data ?? []) as { total?: number }[];
    check("leave_summary counts A's working days", leaveSum.error === null && sumRows[0]?.total === 2, leaveSum.error?.message);

    // BR-29 / BR-30 / BR-31
    // FR-16: the dashboard function runs as the caller, so B's tasks are not counted.
    const dash = await c.rpc("dashboard_summary", { p_year: YEAR, p_owner_id: b.id });
    const dashData = dash.data as { totals?: { open?: number }; people?: unknown[] } | null;
    check(
      "A's dashboard does not count B's tasks",
      dash.error === null && dashData?.totals?.open === 0 && (dashData?.people ?? []).length === 0,
      dash.error?.message,
    );

    const units = await c.from("units").select("id");
    check("A can read units", (units.data ?? []).length === 4, units.error?.message);
    const unitIns = await c.from("units").insert({ id: "rls_test", name: "rls_test_unit" });
    check("A cannot create units", unitIns.error !== null);
    const posUpd = await c.from("profiles").update({ position: "หัวหน้า" }).eq("id", a.id).select("id");
    check("A cannot change own position", posUpd.error !== null || (posUpd.data ?? []).length === 0);
    const yearUpd = await c.from("profiles").update({ year_type: "calendar" }).eq("id", a.id).select("id");
    check("A cannot update own profile directly (server action only)", yearUpd.error !== null || (yearUpd.data ?? []).length === 0);
  }

  // ------------------------------------------------------------------ admin
  console.log("\nAdmin");
  {
    const c = admin.client;

    const tasks = await c.from("tasks").select("id").in("id", [taskA, taskB]);
    check("admin reads A's and B's tasks", (tasks.data ?? []).length === 2, tasks.error?.message);

    const upd = await c.from("tasks").update({ priority: 1 }).eq("id", taskB).select("id");
    check("admin can update B's task", (upd.data ?? []).length === 1, upd.error?.message);

    const hist = await c.from("task_history").insert({ task_id: taskB, from_status: "short_term", to_status: "in_progress", changed_by: admin.id });
    check("admin can write history on B's task as admin", hist.error === null, hist.error?.message);

    const histRead = await c.from("task_history").select("id").eq("task_id", taskB);
    check("admin reads B's task history", (histRead.data ?? []).length >= 2, histRead.error?.message);

    const profiles = await c.from("profiles").select("id").in("id", [a.id, b.id, admin.id]);
    check("admin reads all profiles", (profiles.data ?? []).length === 3, profiles.error?.message);

    const adminLeave = await c
      .from("leaves")
      .insert({ owner_id: b.id, created_by: admin.id, leave_type: "official", start_date: "2026-11-23", end_date: "2026-11-23" })
      .select("id");
    check("admin can record leave for B", (adminLeave.data ?? []).length === 1, adminLeave.error?.message);
    const readA = await c.from("leaves").select("id").eq("owner_id", a.id);
    check("admin reads A's leaves", (readA.data ?? []).length === 1, readA.error?.message);

    const catUpd = await c.from("categories").update({ sort_order: 1 }).eq("id", category.id).select("id");
    check("admin can update categories", (catUpd.data ?? []).length === 1, catUpd.error?.message);

    const setUpd = await c.from("app_settings").update({ fiscal_start_month: 10 }).eq("id", true).select("id");
    check("admin can update app_settings", (setUpd.data ?? []).length === 1, setUpd.error?.message);

    // FR-18: reorder needs the full list; reversing twice restores the original order.
    const ordered = must(await c.from("categories").select("id").order("sort_order").order("name"), "read order");
    const ids = ordered.map((r) => r.id);
    const partial = await c.rpc("reorder_categories", { p_ids: ids.slice(1) });
    check("admin reorder rejects an incomplete list", partial.error !== null);
    const reversed = await c.rpc("reorder_categories", { p_ids: [...ids].reverse() });
    const after = must(await c.from("categories").select("id").order("sort_order"), "read order");
    check(
      "admin can reorder categories",
      reversed.error === null && after[0]?.id === ids[ids.length - 1],
      reversed.error?.message,
    );
    const restore = await c.rpc("reorder_categories", { p_ids: ids });
    if (restore.error) throw new Error(`restore order: ${restore.error.message}`);
  }

  // ------------------------------------------------------------------ inactive
  console.log("\nDeactivated users (session still valid)");
  {
    must(await service.from("profiles").update({ is_active: false }).eq("id", a.id).select("id"), "deactivate A");
    const c = a.client;

    const tasks = await c.from("tasks").select("id");
    check("inactive A reads no tasks", (tasks.data ?? []).length === 0);
    const profiles = await c.from("profiles").select("id");
    check("inactive A reads no profile", (profiles.data ?? []).length === 0);
    const cats = await c.from("categories").select("id");
    check("inactive A reads no categories", (cats.data ?? []).length === 0);
    const settings = await c.from("app_settings").select("id");
    check("inactive A reads no app_settings", (settings.data ?? []).length === 0);
    const ins = await c
      .from("tasks")
      .insert({ owner_id: a.id, title: "x", status: "short_term", category_id: category.id, year: YEAR });
    check("inactive A cannot create tasks", ins.error !== null);
    const upd = await c.from("tasks").update({ title: "x" }).eq("id", taskA).select("id");
    check("inactive A cannot update own task", (upd.data ?? []).length === 0);

    must(await service.from("profiles").update({ is_active: false }).eq("id", admin.id).select("id"), "deactivate admin");
    const adminTasks = await admin.client.from("tasks").select("id").in("id", [taskA, taskB]);
    check("inactive admin reads no tasks", (adminTasks.data ?? []).length === 0);
    const adminUpd = await admin.client.from("tasks").update({ priority: 3 }).eq("id", taskB).select("id");
    check("inactive admin cannot update tasks", (adminUpd.data ?? []).length === 0);
  }

  // ------------------------------------------------------------------ BR-27
  console.log("\nBR-27 (at least one active admin)");
  {
    // Test admin is inactive now, so deactivating every real admin must be rejected
    // as a whole statement, even with the service role.
    const realIds = (realAdmins as { id: string }[]).map((p) => p.id);
    const attempt = await service
      .from("profiles")
      .update({ is_active: false })
      .in("id", realIds)
      .select("id");
    const ok = attempt.error !== null;
    if (!ok) {
      // Trigger did not fire: restore immediately before reporting.
      await service.from("profiles").update({ is_active: true }).in("id", realIds);
    }
    check("cannot deactivate the last active admin", ok, attempt.error ? undefined : "update was allowed");

    const demote = await service.from("profiles").update({ role: "user" }).in("id", realIds).select("id");
    if (demote.error === null) {
      await service.from("profiles").update({ role: "admin" }).in("id", realIds);
    }
    check("cannot demote the last active admin", demote.error !== null, demote.error ? undefined : "update was allowed");
  }
}

main()
  .catch((error: unknown) => {
    failed++;
    console.error(`\nAborted: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
  })
  .finally(async () => {
    console.log("\nCleaning up test data...");
    await cleanup();
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
