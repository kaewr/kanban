"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { callAdminApi } from "@/lib/admin/client";
import type { AdminUserRow } from "./types";

/** Edit display name and role (role locked on your own account, BR-27). */
export function EditUserDialog({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { displayName: form.get("displayName") };
    if (!isSelf) body.role = form.get("role");

    setPending(true);
    setError(undefined);
    const result = await callAdminApi(`/api/admin/users/${user.id}`, "PATCH", body);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const idPrefix = `edit-${user.id}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label={`แก้ไข ${user.username}`} />}>
        แก้ไข
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>แก้ไขผู้ใช้ {user.username}</DialogTitle>
          </DialogHeader>

          <FormMessage error={error} />

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-name`}>ชื่อที่แสดง</Label>
            <Input id={`${idPrefix}-name`} name="displayName" defaultValue={user.displayName} maxLength={100} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-role`}>บทบาท</Label>
            <NativeSelect id={`${idPrefix}-role`} name="role" defaultValue={user.role} disabled={isSelf}>
              <option value="user">ผู้ใช้งาน</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </NativeSelect>
            {isSelf && <p className="text-xs text-muted-foreground">เปลี่ยนบทบาทของตัวเองไม่ได้</p>}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
