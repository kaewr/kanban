"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { DISPLAY_NAME_MAX, POSITION_MAX } from "@/lib/admin/users";
import type { UnitOption } from "./types";

/** Shared fields of the create / edit dialogs: name, unit (BR-29), position (BR-30), role. */
export function UserFields({
  idPrefix,
  units,
  defaults,
  roleLocked = false,
}: {
  idPrefix: string;
  units: UnitOption[];
  defaults?: { displayName: string; unitId: string | null; position: string | null; role: "user" | "admin" };
  roleLocked?: boolean;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`}>ชื่อ-นามสกุล</Label>
        <Input
          id={`${idPrefix}-name`}
          name="displayName"
          defaultValue={defaults?.displayName}
          maxLength={DISPLAY_NAME_MAX}
          placeholder="เช่น สมชาย ใจดี"
          required
        />
        <p className="text-xs text-muted-foreground">ชื่อนี้แสดงในรายการให้เลือกตอนเข้าสู่ระบบ</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-unit`}>สังกัดงาน</Label>
          <NativeSelect id={`${idPrefix}-unit`} name="unitId" defaultValue={defaults?.unitId ?? ""} required>
            <option value="" disabled>
              เลือกสังกัดงาน
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-role`}>บทบาท</Label>
          <NativeSelect id={`${idPrefix}-role`} name="role" defaultValue={defaults?.role ?? "user"} disabled={roleLocked}>
            <option value="user">ผู้ใช้งาน</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </NativeSelect>
          {roleLocked && <p className="text-xs text-muted-foreground">เปลี่ยนบทบาทของตัวเองไม่ได้</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-position`}>ตำแหน่ง</Label>
        <Input
          id={`${idPrefix}-position`}
          name="position"
          defaultValue={defaults?.position ?? ""}
          maxLength={POSITION_MAX}
          placeholder="เช่น นักวิชาการศึกษา"
        />
        <p className="text-xs text-muted-foreground">ผู้ใช้แก้ตำแหน่งของตัวเองไม่ได้ แก้ได้ที่หน้านี้เท่านั้น</p>
      </div>
    </>
  );
}
