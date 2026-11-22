import Link from "next/link";
import { AppNav, type NavItem } from "@/components/app-nav";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireProfile } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
        <Link href={ROUTES.home} className="flex shrink-0 items-center gap-2.5" aria-label="Kanban บันทึกงาน หน้าแรก">
          <BrandMark />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-semibold tracking-tight">Kanban บันทึกงาน</span>
            <span className="text-[11px] font-medium text-brand-gold">ICT · University of Phayao</span>
          </span>
        </Link>
        {children}
      </div>
    </header>
  );
}

/** Two-letter avatar from the display name (Thai names: first two characters). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && /^[A-Za-z]/.test(parts[0])) return (parts[0][0] + parts[1][0]).toUpperCase();
  return Array.from(parts[0] ?? "").slice(0, 2).join("").toUpperCase();
}

export async function AppHeader() {
  const profile = await requireProfile();

  const items: NavItem[] = [
    { href: ROUTES.board, label: "บอร์ด", icon: "board" },
    { href: ROUTES.dashboard, label: "Dashboard", icon: "dashboard" },
    { href: ROUTES.leave, label: "วันลา", icon: "leave" },
  ];
  if (profile.role === "admin") {
    items.push({ href: ROUTES.admin, label: "Admin", icon: "admin" });
  }

  return (
    <Shell>
      <AppNav items={items} />
      <ThemeToggle className="ml-auto" />
      <Link
        href={ROUTES.profile}
        className="flex min-w-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm transition-colors hover:bg-muted"
        title="โปรไฟล์"
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-gold-soft text-xs font-semibold text-brand-gold ring-1 ring-brand-gold/30"
        >
          {initials(profile.displayName)}
        </span>
        <span className="hidden max-w-36 truncate md:inline">{profile.displayName}</span>
      </Link>
    </Shell>
  );
}

export function AppHeaderFallback() {
  return <Shell />;
}
