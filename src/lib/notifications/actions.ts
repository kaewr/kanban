"use server";

import { getCurrentProfile } from "@/lib/auth";
import { listPeople } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";

// BR-56: in-app notifications. RLS returns only the caller's rows; the caller may only
// set read_at (column grant).

export type NotificationItem = {
  id: number;
  kind: string;
  actor: string;
  taskTitle: string;
  message: string | null;
  createdAt: string;
  read: boolean;
};

export type NotificationFeed = { unread: number; items: NotificationItem[] };

const EMPTY: NotificationFeed = { unread: 0, items: [] };

export async function loadNotifications(): Promise<NotificationFeed> {
  // Never throws or redirects: the bell polls in the background.
  const profile = await getCurrentProfile();
  if (!profile) return EMPTY;
  const supabase = await createClient();
  const [listRes, unreadRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, actor_id, task_title, message, created_at, read_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("read_at", null),
  ]);
  if (listRes.error || unreadRes.error) return EMPTY;

  const names = listRes.data.some((n) => n.actor_id)
    ? new Map((await listPeople()).map((p) => [p.id, p.name]))
    : new Map<string, string>();
  return {
    unread: unreadRes.count ?? 0,
    items: listRes.data.map((n) => ({
      id: n.id,
      kind: n.kind,
      actor: (n.actor_id && names.get(n.actor_id)) || "ระบบ",
      taskTitle: n.task_title,
      message: n.message,
      createdAt: n.created_at,
      read: n.read_at !== null,
    })),
  };
}

export async function markAllNotificationsRead(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);
}
