// Creates the first admin account (username "admin", password = DEFAULT_PASSWORD,
// must_change_password = true). Safe to run more than once.
//
// Usage: npm run db:create-admin
import { createClient } from "@supabase/supabase-js";

const USERNAME = "admin";
const DISPLAY_NAME = "ผู้ดูแลระบบ";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env ${name} (check .env.local)`);
    process.exit(1);
  }
  return value;
}

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const defaultPassword = requireEnv("DEFAULT_PASSWORD");

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `${USERNAME}@kanban.local`; // BR-21

async function findAuthUserId(): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 100) return null;
  }
}

async function main(): Promise<void> {
  const { data: existing, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("username", USERNAME)
    .maybeSingle();
  if (profileError) throw profileError;

  if (existing) {
    console.log(`Profile "${USERNAME}" already exists (role=${existing.role}, is_active=${existing.is_active}). Nothing to do.`);
    return;
  }

  let userId = await findAuthUserId();
  if (userId) {
    console.log(`Auth user ${email} already exists, creating missing profile.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created auth user ${email}.`);
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: userId,
    username: USERNAME,
    display_name: DISPLAY_NAME,
    role: "admin",
    must_change_password: true,
    is_active: true,
  });
  if (insertError) throw insertError;

  console.log(`Created admin profile "${USERNAME}". Log in with DEFAULT_PASSWORD; a password change will be required.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  console.error(`Failed: ${message}`);
  process.exit(1);
});
