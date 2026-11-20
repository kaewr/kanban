import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { FormMessage } from "@/components/form-message";
import { LOGIN_REASON_INACTIVE } from "@/lib/routes";
import { LoginForm } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ | Kanban Board บันทึกงาน" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  // The form renders in the static shell and is never swapped out, so typed input
  // is not lost while request-time data streams in.
  return (
    <AuthCard title="Kanban Board บันทึกงาน" description="เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน">
      <div className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <InactiveNotice searchParams={searchParams} />
        </Suspense>
        <LoginForm />
      </div>
    </AuthCard>
  );
}

async function InactiveNotice({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  if (params.reason !== LOGIN_REASON_INACTIVE) return null;
  return <FormMessage error="บัญชีของคุณถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" />;
}
