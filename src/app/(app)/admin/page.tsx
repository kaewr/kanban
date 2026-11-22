import { CalendarCogIcon, ChevronRightIcon, Columns3Icon, ShieldIcon, TagsIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

export const metadata = { title: "Admin | Kanban Board บันทึกงาน" };

const SECTIONS = [
  {
    href: ROUTES.adminUsers,
    icon: UsersIcon,
    title: "จัดการผู้ใช้",
    description: "เพิ่มผู้ใช้ กำหนดบทบาท รีเซ็ตรหัสผ่าน ปิด/เปิดการใช้งาน",
  },
  {
    href: ROUTES.board,
    icon: Columns3Icon,
    title: "บอร์ดของผู้ใช้",
    description: "เลือก \"บอร์ดของ\" ที่หน้าบอร์ดเพื่อดูและแก้งานของผู้ใช้แต่ละคน",
  },
  {
    href: ROUTES.adminCategories,
    icon: TagsIcon,
    title: "หมวดหมู่งาน",
    description: "เพิ่ม แก้ชื่อ เรียงลำดับ ปิด/เปิดใช้งานหมวดหมู่",
  },
  {
    href: ROUTES.adminSettings,
    icon: CalendarCogIcon,
    title: "ตั้งค่ารูปแบบปี",
    description: "ปีปฏิทิน หรือ ปีงบประมาณ และเดือนเริ่มปีงบ",
  },
] as const;

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldIcon className="size-6 text-primary" aria-hidden />
          Admin
        </h1>
        <p className="text-sm text-muted-foreground">จัดการผู้ใช้ บอร์ด หมวดหมู่ และการตั้งค่าของระบบ</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="group rounded-xl focus-visible:outline-2">
            <Card className="h-full transition-[box-shadow,transform] duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md">
              <CardHeader className="flex flex-row items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <CardTitle className="flex items-center justify-between gap-2">
                    {title}
                    <ChevronRightIcon
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </CardTitle>
                  <CardDescription>{description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
