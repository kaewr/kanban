import { UserRoundIcon } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { PasswordForm } from "@/components/password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "โปรไฟล์ | Kanban Board บันทึกงาน" };

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
          <CardTitle>ข้อมูลผู้ใช้</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">ชื่อผู้ใช้</dt>
            <dd>{profile.username}</dd>
            <dt className="text-muted-foreground">ชื่อที่แสดง</dt>
            <dd>{profile.displayName}</dd>
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
