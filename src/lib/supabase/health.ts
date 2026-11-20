import "server-only";
import { connection } from "next/server";

export type SupabaseHealth =
  | { ok: true; host: string }
  | { ok: false; reason: string };

// Pings the Supabase Auth health endpoint with the publishable key.
// Proves both that the project URL is reachable and that the key is accepted,
// without depending on any table (tables arrive in M2).
export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  // Run at request time, never during prerender.
  await connection();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return {
      ok: false,
      reason:
        "ไม่พบค่า NEXT_PUBLIC_SUPABASE_URL หรือ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ใน .env.local",
    };
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      return { ok: true, host: new URL(url).host };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: `key ไม่ถูกต้อง (HTTP ${res.status})` };
    }
    return { ok: false, reason: `Supabase ตอบกลับ HTTP ${res.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `เชื่อมต่อเครือข่ายไม่ได้: ${message}` };
  }
}
