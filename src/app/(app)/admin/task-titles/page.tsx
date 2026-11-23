import { ChevronLeftIcon, ListChecksIcon } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { PresetManager } from "./preset-manager";

export const metadata = { title: "หัวข้องาน | Kanban Board บันทึกงาน" };
// Every page reads the session per request, so it cannot be an instant navigation.
export const instant = false;

export default async function AdminTaskTitlesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_title_presets")
    .select("id, name, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw new Error("โหลดหัวข้องานไม่สำเร็จ");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={ROUTES.admin} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeftIcon className="size-4" aria-hidden />
          Admin
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ListChecksIcon className="size-6 text-primary" aria-hidden />
          หัวข้องาน
        </h1>
        <p className="text-sm text-muted-foreground">
          รายการให้เลือกในช่อง &ldquo;หัวข้องาน&rdquo; ตอนเพิ่มงาน ผู้ใช้ยังพิมพ์ชื่องานเองได้ แก้หรือลบหัวข้อที่นี่ไม่กระทบงานที่บันทึกไปแล้ว
        </p>
      </div>
      <PresetManager presets={data.map((p) => ({ id: p.id, name: p.name, sortOrder: p.sort_order }))} />
    </div>
  );
}
