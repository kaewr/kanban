import { UserRoundIcon } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { PasswordForm } from "@/components/password-form";
import { ProfileForm } from "@/components/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "โปรไฟล์ | Kanban Board บันทึกงาน" };
// Every page reads the session per request, so it cannot be an instant navigation.
export const instant = false;

const ROLE_LABEL = { admin: "ผู้ดูแลระบบ", user: "ผู้ใช้งาน" } as const;

export default async function ProfilePage() {
  const profile = await requireProfile();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <UserRoundIcon className="size-6 text-primary" aria-hidden />
        โปรไฟล์
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลส่วนตัว</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm displayName={profile.displayName} yearType={profile.yearType} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>สังกัดและตำแหน่ง</CardTitle>
          <CardDescription>แก้ไขได้โดยผู้ดูแลระบบเท่านั้น</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm" data-testid="profile-org">
            <dt className="text-muted-foreground">สังกัดงาน</dt>
            <dd>{profile.unitName ?? "—"}</dd>
            <dt className="text-muted-foreground">ตำแหน่ง</dt>
            <dd>{profile.position ?? "—"}</dd>
            <dt className="text-muted-foreground">บทบาท</dt>
            <dd>{ROLE_LABEL[profile.role]}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>เปลี่ยนรหัสผ่าน</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <LogoutButton />
    </div>
  );
}
