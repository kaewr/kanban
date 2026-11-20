import { PlaceholderPage } from "@/components/placeholder-page";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin | Kanban Board บันทึกงาน" };

export default async function AdminPage() {
  await requireAdmin();
  return <PlaceholderPage title="Admin" note="กำลังพัฒนา (M4, M7)" />;
}
