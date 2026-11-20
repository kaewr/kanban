// Browser helper for calling /api/admin routes.

export type AdminApiResult = { ok: true } | { ok: false; error: string };

export async function callAdminApi(
  path: string,
  method: "POST" | "PATCH",
  body?: Record<string, unknown>,
): Promise<AdminApiResult> {
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };

    const data: unknown = await res.json().catch(() => null);
    const error =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
    return { ok: false, error };
  } catch {
    return { ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง" };
  }
}
