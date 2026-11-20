import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { LogoutButton } from "@/components/logout-button";
import { PasswordForm } from "@/components/password-form";
import { getCurrentProfile } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

export const metadata = { title: "ตั้งรหัสผ่านใหม่ | Kanban Board บันทึกงาน" };

export default function ChangePasswordPage() {
  return (
    <AuthCard
      title="ตั้งรหัสผ่านใหม่"
      description="คุณกำลังใช้รหัสผ่านเริ่มต้น กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน"
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">กำลังโหลด…</p>}>
        <RequiredPasswordChange />
      </Suspense>
    </AuthCard>
  );
}

async function RequiredPasswordChange() {
  const profile = await getCurrentProfile();
  if (!profile) redirect(ROUTES.login);
  if (!profile.mustChangePassword) redirect(ROUTES.home);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        ชื่อผู้ใช้: <span className="font-medium">{profile.username}</span>
      </p>
      <PasswordForm mode="required" />
      <LogoutButton />
    </div>
  );
}
