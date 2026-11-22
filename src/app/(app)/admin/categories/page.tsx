import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { CategoryManager } from "./category-manager";

export const metadata = { title: "หมวดหมู่งาน | Kanban Board บันทึกงาน" };

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, sort_order, is_active")
    .order("sort_order")
    .order("name");
  if (error) throw new Error("โหลดหมวดหมู่ไม่สำเร็จ");

  const categories = data.map((c) => ({
    id: c.id,
    name: c.name,
    sortOrder: c.sort_order,
    isActive: c.is_active,
  }));

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={ROUTES.admin} className="text-sm text-muted-foreground hover:underline">
          ← Admin
        </Link>
        <h1 className="text-2xl font-semibold">หมวดหมู่งาน</h1>
        <p className="text-sm text-muted-foreground">
          ลำดับนี้ใช้ในช่องเลือกหมวดหมู่ของงาน หมวดที่ปิดใช้งานจะเลือกให้งานใหม่ไม่ได้ แต่งานเดิมยังแสดงตามปกติ
        </p>
      </div>
      <CategoryManager categories={categories} />
    </div>
  );
}
