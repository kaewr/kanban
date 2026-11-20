import Link from "next/link";
import { AppNav, type NavItem } from "@/components/app-nav";
import { requireProfile } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

const APP_NAME = "Kanban บันทึกงาน";

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
        <Link href={ROUTES.home} className="shrink-0 font-semibold">
          {APP_NAME}
        </Link>
        {children}
      </div>
    </header>
  );
}

export async function AppHeader() {
  const profile = await requireProfile();

  const items: NavItem[] = [
    { href: ROUTES.board, label: "บอร์ด" },
    { href: ROUTES.dashboard, label: "Dashboard" },
  ];
  if (profile.role === "admin") {
    items.push({ href: ROUTES.admin, label: "Admin" });
  }

  return (
    <Shell>
      <AppNav items={items} />
      <Link
        href={ROUTES.profile}
        className="ml-auto max-w-40 truncate rounded-md px-2 py-1 text-sm hover:bg-muted"
        title="โปรไฟล์"
      >
        {profile.displayName}
      </Link>
    </Shell>
  );
}

export function AppHeaderFallback() {
  return <Shell />;
}
