import { connection } from "next/server";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { FormMessage } from "@/components/form-message";
import { listLoginGroups } from "@/lib/accounts";
import { LOGIN_REASON_INACTIVE } from "@/lib/routes";
import { LoginForm, LoginFormSkeleton } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ | Kanban Board บันทึกงาน" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard title="Kanban Board บันทึกงาน" description="เลือกชื่อของคุณ แล้วกรอกรหัสผ่าน">
      <div className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <InactiveNotice searchParams={searchParams} />
        </Suspense>
        {/* The form appears only once the name list is loaded, so nothing typed is lost. */}
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginFormWithAccounts />
        </Suspense>
      </div>
    </AuthCard>
  );
}

async function LoginFormWithAccounts() {
  await connection(); // the account list is read per request, never prerendered
  const groups = await listLoginGroups();
  return <LoginForm groups={groups} />;
}

async function InactiveNotice({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  if (params.reason !== LOGIN_REASON_INACTIVE) return null;
  return <FormMessage error="บัญชีของคุณถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" />;
}
