// Adds the staff of งานวิชาการ (BR-29) with role user and the default password
// (must_change_password = true -> FR-02 warning). Safe to run more than once:
// accounts are matched by their fixed internal username and skipped if present.
//
// Usage: npm run db:seed-users          (local, .env.local)
//        npm run db:seed-users:prod     (production, .env.prod) — only when asked
import { createClient } from "@supabase/supabase-js";

const UNIT_ID = "academic";
const STAFF = [
  { username: "academic01", displayName: "ดลทิชา เชี่ยวสุวรรณ", position: "หัวหน้างานวิชาการ" },
  { username: "academic02", displayName: "นภัทร ไชยมงคล", position: "นักวิชาการศึกษา" },
  { username: "academic03", displayName: "ณัฏฐ์ กรีธาชาติ", position: "นักวิชาการศึกษา" },
  { username: "academic04", displayName: "กิตติคุณ นุผัด", position: "นักวิชาการศึกษา" },
  { username: "academic05", displayName: "ประนอม เครือวัลย์", position: "นักวิทยาศาสตร์" },
  { username: "academic06", displayName: "ทิวากร สมวรรณ", position: "ครู" },
  { username: "academic07", displayName: "ธวัชชัย แสนแก้ว", position: "ครู" },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
  return value;
}

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabase = createClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const password = requireEnv("DEFAULT_PASSWORD");

console.log(`Project: ${new URL(url).hostname}\n`);

let created = 0;
for (const person of STAFF) {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", person.username)
    .maybeSingle();
  if (readError) throw new Error(`read ${person.username}: ${readError.message}`);
  if (existing) {
    console.log(`  skip   ${person.displayName} (already exists)`);
    continue;
  }

  const auth = await supabase.auth.admin.createUser({
    email: `${person.username}@kanban.local`, // BR-21
    password,
    email_confirm: true,
  });
  if (auth.error || !auth.data.user) throw new Error(`create ${person.username}: ${auth.error?.message}`);

  const { error } = await supabase.from("profiles").insert({
    id: auth.data.user.id,
    username: person.username,
    display_name: person.displayName,
    unit_id: UNIT_ID,
    position: person.position,
    role: "user",
    must_change_password: true,
  });
  if (error) {
    await supabase.auth.admin.deleteUser(auth.data.user.id);
    throw new Error(`profile ${person.username}: ${error.message}`);
  }
  created++;
  console.log(`  added  ${person.displayName} — ${person.position}`);
}

console.log(`\nDone: ${created} added, ${STAFF.length - created} skipped.`);
