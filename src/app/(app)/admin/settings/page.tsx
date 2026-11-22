import { CalendarCogIcon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { YearSettingsForm } from "./year-settings-form";

export const metadata = { title: "ตั้งค่าปีงบประมาณ | Kanban Board บันทึกงาน" };
// Every page reads the session per request, so it cannot be an instant navigation.
export const instant = false;

export default async function AdminSettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("fiscal_start_month")
    .maybeSingle();
  if (error || !data) throw new Error("โหลดการตั้งค่าไม่สำเร็จ");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={ROUTES.admin} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeftIcon className="size-4" aria-hidden />
          Admin
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CalendarCogIcon className="size-6 text-primary" aria-hidden />
          ตั้งค่าปีงบประมาณ
        </h1>
        <p className="text-sm text-muted-foreground">
          เดือนเริ่มปีงบประมาณใช้ร่วมกันทั้งระบบ ส่วนการแสดงแบบปีงบประมาณหรือปี พ.ศ. ผู้ใช้แต่ละคนเลือกเองที่หน้าโปรไฟล์
        </p>
      </div>
      <YearSettingsForm fiscalStartMonth={data.fiscal_start_month} />
    </div>
  );
}
