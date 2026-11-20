"use client";

import { Button } from "@/components/ui/button";
import { callAdminApi } from "@/lib/admin/client";
import { ConfirmActionDialog } from "./confirm-action-dialog";
import { EditUserDialog } from "./edit-user-dialog";
import type { AdminUserRow } from "./types";

/** Row actions: edit (FR-04), reset password (FR-05), activate/deactivate (FR-06). */
export function UserActions({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <EditUserDialog user={user} isSelf={isSelf} />

      {!isSelf && (
        <ConfirmActionDialog
          trigger={<Button variant="outline" size="sm" aria-label={`รีเซ็ตรหัสผ่าน ${user.username}`} />}
          triggerLabel="รีเซ็ตรหัสผ่าน"
          title={`รีเซ็ตรหัสผ่านของ ${user.displayName}`}
          description="รหัสผ่านจะกลับเป็นรหัสผ่านเริ่มต้น ผู้ใช้จะเห็นแถบเตือนให้เปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบ"
          confirmLabel="รีเซ็ตรหัสผ่าน"
          successMessage="รีเซ็ตรหัสผ่านเรียบร้อยแล้ว แจ้งผู้ใช้ให้เข้าสู่ระบบด้วยรหัสผ่านเริ่มต้น"
          action={() => callAdminApi(`/api/admin/users/${user.id}/reset-password`, "POST")}
        />
      )}

      {!isSelf &&
        (user.isActive ? (
          <ConfirmActionDialog
            trigger={<Button variant="destructive" size="sm" aria-label={`ปิดการใช้งาน ${user.username}`} />}
            triggerLabel="ปิดการใช้งาน"
            title={`ปิดการใช้งาน ${user.displayName}`}
            description="ผู้ใช้จะเข้าสู่ระบบไม่ได้ และถ้ากำลังใช้งานอยู่จะถูกออกจากระบบในคำขอถัดไป ข้อมูลงานยังอยู่ครบ เปิดใช้งานใหม่ได้ภายหลัง"
            confirmLabel="ปิดการใช้งาน"
            destructive
            action={() => callAdminApi(`/api/admin/users/${user.id}`, "PATCH", { isActive: false })}
          />
        ) : (
          <ConfirmActionDialog
            trigger={<Button variant="outline" size="sm" aria-label={`เปิดการใช้งาน ${user.username}`} />}
            triggerLabel="เปิดการใช้งาน"
            title={`เปิดการใช้งาน ${user.displayName}`}
            description="ผู้ใช้จะเข้าสู่ระบบด้วยรหัสผ่านเดิมได้อีกครั้ง"
            confirmLabel="เปิดการใช้งาน"
            action={() => callAdminApi(`/api/admin/users/${user.id}`, "PATCH", { isActive: true })}
          />
        ))}
    </div>
  );
}
