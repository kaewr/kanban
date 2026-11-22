import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { YearSettingsForm } from "./year-settings-form";

export const metadata = { title: "ตั้งค่าปี | Kanban Board บันทึกงาน" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("year_type, fiscal_start_month")
    .maybeSingle();
  if (error || !data) throw new Error("โหลดการตั้งค่าไม่สำเร็จ");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={ROUTES.admin} className="text-sm text-muted-foreground hover:underline">
          ← Admin
        </Link>
        <h1 className="text-2xl font-semibold">ตั้งค่ารูปแบบปี</h1>
      </div>
      <YearSettingsForm
        yearType={data.year_type === "fiscal" ? "fiscal" : "calendar"}
        fiscalStartMonth={data.fiscal_start_month}
      />
    </div>
  );
}
