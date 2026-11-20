import { PlaceholderPage } from "@/components/placeholder-page";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Dashboard | Kanban Board บันทึกงาน" };

export default async function DashboardPage() {
  await requireProfile();
  return <PlaceholderPage title="Dashboard" note="กำลังพัฒนา (M8)" />;
}
