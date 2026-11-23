import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// BR-53: anyone with an account can be tagged as reviewer, but RLS lets normal users
// read only their own profile. Names are already public on the login page (BR-20), so
// the service role is used for the same minimal fields: id, name, unit, active.

export type Person = { id: string; name: string; unitName: string | null; isActive: boolean };

export async function listPeople(): Promise<Person[]> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, display_name, is_active, units(name)")
    .order("display_name");
  if (error) throw new Error("โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
  return data.map((p) => ({
    id: p.id,
    name: p.display_name,
    unitName: p.units?.name ?? null,
    isActive: p.is_active,
  }));
}
