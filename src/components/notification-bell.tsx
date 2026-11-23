"use client";

import { BellIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadNotifications, markAllNotificationsRead, type NotificationFeed } from "@/lib/notifications/actions";
import { notificationHref, notificationText } from "@/lib/reviews";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;

const timeAgo = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );

/** BR-56: in-app notifications. Refreshed on every navigation and once a minute. */
export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [feed, setFeed] = useState<NotificationFeed>({ unread: 0, items: [] });

  const refresh = useCallback(() => {
    loadNotifications()
      .then(setFeed)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function onOpenChange(open: boolean) {
    if (!open || feed.unread === 0) return;
    // Opening the list counts as reading it; the dots stay until the next refresh.
    setFeed((f) => ({ ...f, unread: 0 }));
    markAllNotificationsRead().catch(() => {});
  }

  const label = feed.unread > 0 ? `การแจ้งเตือน ยังไม่อ่าน ${feed.unread} รายการ` : "การแจ้งเตือน";

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={label} className="relative" data-testid="notification-bell" />}
      >
        <BellIcon aria-hidden />
        {feed.unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular-nums"
            data-testid="notification-count"
          >
            {feed.unread > 9 ? "9+" : feed.unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>การแจ้งเตือน</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {feed.items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>
          ) : (
            feed.items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => router.push(notificationHref(n.kind))}
                className="flex flex-col items-start gap-0.5 py-2"
                data-testid="notification-item"
              >
                <span className="flex w-full items-start gap-2">
                  <span
                    aria-hidden
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")}
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{notificationText(n.kind, n.actor)}</span>
                    <span className="block truncate text-muted-foreground">{n.taskTitle}</span>
                    {n.message && <span className="line-clamp-2 block text-xs">&ldquo;{n.message}&rdquo;</span>}
                  </span>
                </span>
                <span className="pl-4 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
