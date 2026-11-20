import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { FormMessage } from "@/components/form-message";
import { LOGIN_REASON_INACTIVE } from "@/lib/routes";
import { LoginForm } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ | Kanban Board บันทึกงาน" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard title="Kanban Board บันทึกงาน" description="เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน">
      <Suspense fallback={<LoginForm next="" />}>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginFormWithParams({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const inactive = params.reason === LOGIN_REASON_INACTIVE;

  return (
    <div className="flex flex-col gap-4">
      {inactive && <FormMessage error="บัญชีของคุณถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" />}
      <LoginForm next={next} />
    </div>
  );
}
