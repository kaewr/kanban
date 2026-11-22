import { ChevronLeftIcon, DatabaseBackupIcon } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { BackupPanel } from "./backup-panel";

export const metadata = { title: "สำรองและกู้คืนข้อมูล | Kanban Board บันทึกงาน" };
// Reads the session per request, so it cannot be an instant navigation.
export const instant = false;

export default async function AdminBackupPage() {
  await requireAdmin();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={ROUTES.admin}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ChevronLeftIcon className="size-4" aria-hidden />
          Admin
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <DatabaseBackupIcon className="size-6 text-primary" aria-hidden />
          สำรองและกู้คืนข้อมูล
        </h1>
        <p className="text-sm text-muted-foreground">
          สำรองงานของทุกคน วันลา หมวดหมู่ และการตั้งค่า เป็นไฟล์เดียว และกู้คืนจากไฟล์ที่เคยสำรองไว้
        </p>
      </div>
      <BackupPanel />
    </div>
  );
}
