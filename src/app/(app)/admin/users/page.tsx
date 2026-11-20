import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { CreateUserDialog } from "./create-user-dialog";
import type { AdminUserRow } from "./types";
import { UserActions } from "./user-actions";

export const metadata = { title: "จัดการผู้ใช้ | Kanban Board บันทึกงาน" };

const ROLE_LABEL = { admin: "ผู้ดูแลระบบ", user: "ผู้ใช้งาน" } as const;

async function loadUsers(): Promise<AdminUserRow[]> {
  // Admin session + RLS (admin reads all profiles); no service role needed to list.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, is_active, must_change_password")
    .order("is_active", { ascending: false })
    .order("display_name");
  if (error) throw new Error("โหลดรายชื่อผู้ใช้ไม่สำเร็จ");

  return data.map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    role: p.role === "admin" ? "admin" : "user",
    isActive: p.is_active,
    mustChangePassword: p.must_change_password,
  }));
}

function StatusBadges({ user }: { user: AdminUserRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {user.isActive ? (
        <Badge variant="secondary">ใช้งาน</Badge>
      ) : (
        <Badge variant="destructive">ปิดใช้งาน</Badge>
      )}
      {user.mustChangePassword && <Badge variant="outline">ยังใช้รหัสผ่านเริ่มต้น</Badge>}
    </div>
  );
}

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const users = await loadUsers();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href={ROUTES.admin} className="text-sm text-muted-foreground hover:underline">
            ← Admin
          </Link>
          <h1 className="text-2xl font-semibold">จัดการผู้ใช้</h1>
          <p className="text-sm text-muted-foreground">ทั้งหมด {users.length} คน</p>
        </div>
        <CreateUserDialog />
      </div>

      {/* Desktop: table */}
      <div className="hidden rounded-xl ring-1 ring-foreground/10 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อที่แสดง</TableHead>
              <TableHead>ชื่อผู้ใช้</TableHead>
              <TableHead>บทบาท</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === admin.id;
              return (
                <TableRow key={user.id} data-username={user.username} className={user.isActive ? "" : "opacity-60"}>
                  <TableCell className="font-medium">
                    {user.displayName}
                    {isSelf && <span className="ml-1 text-muted-foreground">(คุณ)</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{user.username}</TableCell>
                  <TableCell>{ROLE_LABEL[user.role]}</TableCell>
                  <TableCell>
                    <StatusBadges user={user} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <UserActions user={user} isSelf={isSelf} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {users.map((user) => {
          const isSelf = user.id === admin.id;
          return (
            <li
              key={user.id}
              data-username={user.username}
              className={`flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10 ${user.isActive ? "" : "opacity-60"}`}
            >
              <div className="flex flex-col gap-1">
                <p className="font-medium">
                  {user.displayName}
                  {isSelf && <span className="ml-1 text-muted-foreground">(คุณ)</span>}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {user.username} · {ROLE_LABEL[user.role]}
                </p>
                <StatusBadges user={user} />
              </div>
              <UserActions user={user} isSelf={isSelf} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
