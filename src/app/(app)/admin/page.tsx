import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

export const metadata = { title: "Admin | Kanban Board บันทึกงาน" };

const SECTIONS = [
  {
    href: ROUTES.adminUsers,
    title: "จัดการผู้ใช้",
    description: "เพิ่มผู้ใช้ กำหนดบทบาท รีเซ็ตรหัสผ่าน ปิด/เปิดการใช้งาน",
  },
  {
    href: ROUTES.board,
    title: "บอร์ดของผู้ใช้",
    description: "เลือก \"บอร์ดของ\" ที่หน้าบอร์ดเพื่อดูและแก้งานของผู้ใช้แต่ละคน",
  },
  {
    href: ROUTES.adminCategories,
    title: "หมวดหมู่งาน",
    description: "เพิ่ม แก้ชื่อ เรียงลำดับ ปิด/เปิดใช้งานหมวดหมู่",
  },
  {
    href: ROUTES.adminSettings,
    title: "ตั้งค่ารูปแบบปี",
    description: "ปีปฏิทิน หรือ ปีงบประมาณ และเดือนเริ่มปีงบ",
  },
] as const;

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} className="rounded-xl focus-visible:outline-2">
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
