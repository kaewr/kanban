import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SupabaseStatus,
  SupabaseStatusFallback,
} from "@/components/supabase-status";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Kanban Board บันทึกงาน</CardTitle>
          <CardDescription>ตรวจสอบการตั้งค่าโปรเจกต์ (M1)</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<SupabaseStatusFallback />}>
            <SupabaseStatus />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
