import { checkSupabaseHealth } from "@/lib/supabase/health";

export async function SupabaseStatus() {
  const health = await checkSupabaseHealth();

  if (health.ok) {
    return (
      <div className="rounded-lg bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <p className="font-semibold">✅ เชื่อมต่อ Supabase สำเร็จ</p>
        <p className="mt-1 text-sm opacity-80">โปรเจกต์: {health.host}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">
      <p className="font-semibold">❌ เชื่อมต่อ Supabase ไม่ได้</p>
      <p className="mt-1 text-sm opacity-80">{health.reason}</p>
    </div>
  );
}

export function SupabaseStatusFallback() {
  return (
    <div className="rounded-lg bg-muted p-4 text-muted-foreground">
      กำลังตรวจสอบการเชื่อมต่อ Supabase…
    </div>
  );
}
