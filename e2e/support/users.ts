// Test-user management with the service role (Node side only).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { randomBytes, randomUUID } from "node:crypto";

export const E2E_PREFIX = "e2e_";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name} (check .env.local)`);
  return value;
}

let serviceClient: SupabaseClient<Database> | null = null;

export function service(): SupabaseClient<Database> {
  serviceClient ??= createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return serviceClient;
}

export function defaultPassword(): string {
  return requireEnv("DEFAULT_PASSWORD");
}

export function randomTestUsername(): string {
  return `${E2E_PREFIX}${randomBytes(5).toString("hex")}`;
}

export type TestUser = {
  id: string;
  username: string;
  password: string;
  displayName: string;
};

export type TestUserOptions = {
  role?: "user" | "admin";
  /** true = fresh account on DEFAULT_PASSWORD, forced to change it (FR-02). */
  mustChangePassword?: boolean;
};

export async function createTestUser(opts: TestUserOptions = {}): Promise<TestUser> {
  const role = opts.role ?? "user";
  const mustChange = opts.mustChangePassword ?? false;
  const username = randomTestUsername();
  const password = mustChange ? defaultPassword() : `pw-${randomUUID()}`;
  const displayName = `ทดสอบ ${username.slice(E2E_PREFIX.length)}`;

  const created = await service().auth.admin.createUser({
    email: `${username}@kanban.local`,
    password,
    email_confirm: true,
  });
  if (created.error) throw new Error(`createUser ${username}: ${created.error.message}`);
  const id = created.data.user.id;

  const inserted = await service().from("profiles").insert({
    id,
    username,
    display_name: displayName,
    role,
    must_change_password: mustChange,
  });
  if (inserted.error) throw new Error(`insert profile ${username}: ${inserted.error.message}`);

  return { id, username, password, displayName };
}

export async function setActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await service()
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) throw new Error(`setActive: ${error.message}`);
}

export async function deleteTestUser(userId: string): Promise<void> {
  // Demote first so deleting never trips BR-27; tasks/history are cleaned before profile.
  await service().from("profiles").update({ role: "user" }).eq("id", userId);
  const { data: tasks } = await service().from("tasks").select("id").eq("owner_id", userId);
  const taskIds = (tasks ?? []).map((t) => t.id);
  await service().from("task_history").delete().eq("changed_by", userId);
  if (taskIds.length > 0) {
    await service().from("task_history").delete().in("task_id", taskIds);
    await service().from("tasks").delete().in("id", taskIds);
  }
  await service().auth.admin.deleteUser(userId);
}

/** Removes every e2e_* account (leftovers from crashed runs). */
export async function deleteAllTestUsers(): Promise<void> {
  const { data } = await service().auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email?.startsWith(E2E_PREFIX)) {
      await deleteTestUser(user.id);
    }
  }
}

export async function deleteTestUserByUsername(username: string): Promise<void> {
  const { data } = await service().from("profiles").select("id").eq("username", username).maybeSingle();
  if (data) await deleteTestUser(data.id);
}

export async function getProfile(username: string) {
  const { data, error } = await service()
    .from("profiles")
    .select("id, username, display_name, role, is_active, must_change_password")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error(`getProfile: ${error.message}`);
  return data;
}
