"use server";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { loginUsernameFor } from "@/lib/accounts";
import { getCurrentProfile } from "@/lib/auth";
import { getSupabasePublicEnv } from "@/lib/env";
import { passwordUpdateErrorMessage, validateNewPassword } from "@/lib/password";
import { ROUTES, safeNextPath } from "@/lib/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { toAuthEmail } from "@/lib/username";

export type FormState = { error?: string; success?: string };

const INVALID_CREDENTIALS = "รหัสผ่านไม่ถูกต้อง"; // FR-01 (name is picked from a list, BR-20)
const ACCOUNT_INACTIVE = "บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// ---------------------------------------------------------------------------
// FR-01 Login
// ---------------------------------------------------------------------------
export type LoginState = FormState & { userId?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  // BR-20: the user picks their name from the list; the internal username is looked up here.
  const userId = field(formData, "userId");
  const password = field(formData, "password");
  const next = safeNextPath(formData.get("next"));

  if (userId.length === 0) return { error: "กรุณาเลือกชื่อผู้ใช้", userId };
  if (password.length === 0) return { error: INVALID_CREDENTIALS, userId };

  const username = await loginUsernameFor(userId);
  if (!username) return { error: ACCOUNT_INACTIVE, userId };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toAuthEmail(username), // BR-21
    password,
  });

  if (error || !data.user) {
    if (error?.code === "user_banned") {
      // Deactivated accounts are banned in Supabase Auth (BR-26, M4).
      return { error: ACCOUNT_INACTIVE, userId };
    }
    if (error?.code === "over_request_rate_limit") {
      return { error: "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่", userId };
    }
    return { error: INVALID_CREDENTIALS, userId };
  }

  // RLS hides the profile of an inactive account (BR-26).
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: ACCOUNT_INACTIVE, userId };
  }

  // Default-password accounts are not blocked; the app shows a warning banner (FR-02).
  redirect(next);
}

// ---------------------------------------------------------------------------
// Logout (this device only)
// ---------------------------------------------------------------------------
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(ROUTES.login);
}

// ---------------------------------------------------------------------------
// FR-03 Change own password (profile page). Clears the FR-02 warning flag.
// ---------------------------------------------------------------------------
export async function changeOwnPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect(ROUTES.login);

  const newPassword = field(formData, "newPassword");
  const confirmPassword = field(formData, "confirmPassword");

  const invalid = validateNewPassword(newPassword, confirmPassword);
  if (invalid) return { error: invalid };

  const currentPassword = field(formData, "currentPassword");
  if (!(await isCurrentPassword(profile.username, currentPassword))) {
    return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  }
  if (currentPassword === newPassword) {
    return { error: passwordUpdateErrorMessage("same_password") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: passwordUpdateErrorMessage(error.code) };

  if (profile.mustChangePassword) {
    // Users cannot update profiles under RLS; clear the flag with the service role.
    const { error: flagError } = await createAdminClient()
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", profile.id);
    if (flagError) {
      return { error: "เปลี่ยนรหัสผ่านแล้ว แต่บันทึกสถานะไม่สำเร็จ กรุณาลองเปลี่ยนรหัสผ่านอีกครั้ง" };
    }
  }

  refresh(); // re-render the layout so the default-password banner disappears
  return { success: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" };
}

/** Verifies a password with a throwaway client so the current session is untouched. */
async function isCurrentPassword(username: string, password: string): Promise<boolean> {
  if (password.length === 0) return false;
  const { url, publishableKey } = getSupabasePublicEnv();
  const verifier = createSupabaseJsClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await verifier.auth.signInWithPassword({
    email: toAuthEmail(username),
    password,
  });
  if (error) return false;
  await verifier.auth.signOut({ scope: "local" }); // revoke only the verification session
  return true;
}
