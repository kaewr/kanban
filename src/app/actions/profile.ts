"use server";

import { refresh } from "next/cache";
import { isNameTaken, NAME_TAKEN, parseDisplayName } from "@/lib/admin/users";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProfileFormState = { error?: string; success?: string };

/**
 * Users edit their own name and year type (BR-31). They have no UPDATE grant on
 * profiles, so this uses the service role and writes only these two fields;
 * unit, position and role stay admin-only (BR-30).
 */
export async function updateOwnProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const profile = await requireProfile();

  const name = parseDisplayName(formData.get("displayName"));
  if (!name.ok) return { error: name.error };
  const yearType = formData.get("yearType");
  if (yearType !== "fiscal" && yearType !== "calendar") return { error: "กรุณาเลือกแบบปี" };

  const supabase = createAdminClient();
  if (await isNameTaken(supabase, name.value, profile.id)) return { error: NAME_TAKEN };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name.value, year_type: yearType })
    .eq("id", profile.id);
  if (error) return { error: "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };

  refresh();
  return { success: "บันทึกข้อมูลแล้ว" };
}
