import { PlaceholderPage } from "@/components/placeholder-page";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "บอร์ด | Kanban Board บันทึกงาน" };

export default async function BoardPage() {
  await requireProfile();
  return <PlaceholderPage title="บอร์ด" note="กำลังพัฒนา (M5)" />;
}
