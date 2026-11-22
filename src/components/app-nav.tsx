"use client";

import { CalendarOffIcon, KanbanIcon, LayoutDashboardIcon, ShieldIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Icons are looked up by name: components cannot be passed from the server header.
const ICONS = { board: KanbanIcon, dashboard: LayoutDashboardIcon, leave: CalendarOffIcon, admin: ShieldIcon } satisfies Record<
  string,
  LucideIcon
>;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 sm:px-3 transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {/* Icons only on small phones; the label stays for screen readers. */}
            <span className="max-sm:sr-only">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
