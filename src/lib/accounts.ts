import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// BR-20 (changed 22 Nov 2026): people log in by picking their Thai name, so the
// login page needs the list of active accounts before anyone is signed in. RLS
// hides profiles from anonymous users, hence the service role, limited to the
// fields shown on the login page.

export type LoginAccount = { id: string; displayName: string };
export type LoginGroup = { unit: string; accounts: LoginAccount[] };

const NO_UNIT = "ไม่ระบุสังกัด";

export async function listLoginGroups(): Promise<LoginGroup[]> {
  const supabase = createAdminClient();
  const [profilesRes, unitsRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, unit_id").eq("is_active", true).order("display_name"),
    supabase.from("units").select("id, name").order("sort_order"),
  ]);
  if (profilesRes.error || unitsRes.error) throw new Error("โหลดรายชื่อผู้ใช้ไม่สำเร็จ");

  const groups: LoginGroup[] = unitsRes.data.map((u) => ({
    unit: u.name,
    accounts: profilesRes.data
      .filter((p) => p.unit_id === u.id)
      .map((p) => ({ id: p.id, displayName: p.display_name })),
  }));
  const noUnit = profilesRes.data
    .filter((p) => p.unit_id === null)
    .map((p) => ({ id: p.id, displayName: p.display_name }));
  if (noUnit.length > 0) groups.push({ unit: NO_UNIT, accounts: noUnit });

  return groups.filter((g) => g.accounts.length > 0);
}

/** Internal username of an active account, or null. */
export async function loginUsernameFor(profileId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("username")
    .eq("id", profileId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.username ?? null;
}
