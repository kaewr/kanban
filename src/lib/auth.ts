import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/routes";
import type { UserRole } from "@/types/domain";

export type CurrentProfile = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
};

/**
 * The signed-in user's profile, or null when signed out / inactive
 * (RLS hides the row of an inactive account). Deduplicated per request.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, must_change_password")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    role: profile.role === "admin" ? "admin" : "user",
    mustChangePassword: profile.must_change_password,
  };
});

/** For app pages and actions: signed in and active. */
export async function requireProfile(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect(ROUTES.login);
  return profile;
}

export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect(ROUTES.home);
  return profile;
}
