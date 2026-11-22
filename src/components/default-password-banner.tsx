import { KeyRoundIcon } from "lucide-react";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

/**
 * FR-02 (changed 2026-11-20): accounts on the default password are not blocked,
 * but see this non-dismissible warning on every page until they change it.
 */
export async function DefaultPasswordBanner() {
  const profile = await getCurrentProfile();
  if (!profile?.mustChangePassword) return null;

  return (
    <div
      data-testid="default-password-banner"
      role="region"
      aria-label="แจ้งเตือนรหัสผ่าน"
      className="border-b border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
        <KeyRoundIcon className="size-4 shrink-0" aria-hidden />
        <p className="flex-1">
          คุณยังใช้รหัสผ่านเริ่มต้น เพื่อความปลอดภัยควรเปลี่ยนรหัสผ่าน
        </p>
        <Link
          href={ROUTES.profile}
          className="shrink-0 rounded-lg bg-amber-600 px-3 py-1 font-medium text-white transition-colors hover:bg-amber-700"
        >
          เปลี่ยนรหัสผ่าน
        </Link>
      </div>
    </div>
  );
}
