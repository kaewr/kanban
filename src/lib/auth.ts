import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_MUST_CHANGE_PASSWORD, ROUTES } from "@/lib/routes";
import type { UserRole, YearType } from "@/types/domain";

export type CurrentProfile = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
  unitId: string | null;
  unitName: string | null;
  position: string | null;
  /** BR-31: the user's own choice of year (fiscal by default). */
  yearType: YearType;
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
    .select("id, username, display_name, role, must_change_password, unit_id, position, year_type, units(name)")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    role: profile.role === "admin" ? "admin" : "user",
    mustChangePassword: profile.must_change_password,
    unitId: profile.unit_id,
    unitName: profile.units?.name ?? null,
    position: profile.position,
    yearType: profile.year_type === "calendar" ? "calendar" : "fiscal",
  };
});

/**
 * For app pages and actions: signed in and active. An admin still on the default
 * password is sent to /profile first (BR-59) unless the caller is the profile page
 * or its own actions (`allowMustChange`).
 */
export async function requireProfile(opts: { allowMustChange?: boolean } = {}): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect(ROUTES.login);
  if (!opts.allowMustChange && mustChangeBeforeUse(profile)) {
    redirect(`${ROUTES.profile}?reason=${ADMIN_MUST_CHANGE_PASSWORD}`);
  }
  return profile;
}

export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect(ROUTES.home);
  // BR-59: no admin work on the default password (the DB's is_admin() agrees).
  if (profile.mustChangePassword) redirect(`${ROUTES.profile}?reason=${ADMIN_MUST_CHANGE_PASSWORD}`);
  return profile;
}

/** BR-59: an admin still on the default password must change it before anything else. */
export function mustChangeBeforeUse(profile: Pick<CurrentProfile, "role" | "mustChangePassword">): boolean {
  return profile.role === "admin" && profile.mustChangePassword;
}
