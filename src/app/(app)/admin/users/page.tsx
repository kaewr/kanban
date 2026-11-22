import { ChevronLeftIcon, UsersIcon } from "lucide-react";
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
import type { AdminUserRow, UnitOption } from "./types";
import { UnitFilter } from "./unit-filter";
import { UserActions } from "./user-actions";

export const metadata = { title: "จัดการผู้ใช้ | Kanban Board บันทึกงาน" };

const ROLE_LABEL = { admin: "ผู้ดูแลระบบ", user: "ผู้ใช้งาน" } as const;

async function loadData(): Promise<{ users: AdminUserRow[]; units: UnitOption[] }> {
  // Admin session + RLS (admin reads all profiles); no service role needed to list.
  const supabase = await createClient();
  const [usersRes, unitsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, role, is_active, must_change_password, unit_id, position, units(name)")
      .order("is_active", { ascending: false })
      .order("display_name"),
    supabase.from("units").select("id, name").order("sort_order"),
  ]);
  if (usersRes.error || unitsRes.error) throw new Error("โหลดรายชื่อผู้ใช้ไม่สำเร็จ");

  return {
    units: unitsRes.data,
    users: usersRes.data.map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      role: p.role === "admin" ? "admin" : "user",
      isActive: p.is_active,
      mustChangePassword: p.must_change_password,
      unitId: p.unit_id,
      unitName: p.units?.name ?? null,
      position: p.position,
    })),
  };
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

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requireAdmin();
  const [{ users: allUsers, units }, { unit }] = await Promise.all([loadData(), searchParams]);
  const unitFilter = typeof unit === "string" && units.some((u) => u.id === unit) ? unit : "";
  const users = unitFilter ? allUsers.filter((u) => u.unitId === unitFilter) : allUsers;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href={ROUTES.admin}
            className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
            Admin
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <UsersIcon className="size-6 text-primary" aria-hidden />
            จัดการผู้ใช้
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="user-count">
            {unitFilter ? `${users.length} จาก ${allUsers.length} คน` : `ทั้งหมด ${users.length} คน`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <UnitFilter units={units} value={unitFilter} />
          <CreateUserDialog units={units} />
        </div>
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ-นามสกุล</TableHead>
              <TableHead>สังกัดงาน</TableHead>
              <TableHead>ตำแหน่ง</TableHead>
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
                  <TableCell>{user.unitName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{user.position ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{ROLE_LABEL[user.role]}</TableCell>
                  <TableCell>
                    <StatusBadges user={user} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <UserActions user={user} isSelf={isSelf} units={units} />
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
              className={`flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 ${user.isActive ? "" : "opacity-60"}`}
            >
              <div className="flex flex-col gap-1">
                <p className="font-medium">
                  {user.displayName}
                  {isSelf && <span className="ml-1 text-muted-foreground">(คุณ)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[user.position, user.unitName, ROLE_LABEL[user.role]].filter(Boolean).join(" · ")}
                </p>
                <StatusBadges user={user} />
              </div>
              <UserActions user={user} isSelf={isSelf} units={units} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
