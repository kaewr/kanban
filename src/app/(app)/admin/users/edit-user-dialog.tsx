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
import { callAdminApi } from "@/lib/admin/client";
import type { AdminUserRow, UnitOption } from "./types";
import { UserFields } from "./user-fields";

/** Edit name, unit, position and role (role locked on your own account, BR-27). */
export function EditUserDialog({ user, isSelf, units }: { user: AdminUserRow; isSelf: boolean; units: UnitOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      displayName: form.get("displayName"),
      unitId: form.get("unitId"),
      position: form.get("position"),
    };
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
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label={`แก้ไข ${user.displayName}`} />}>
        แก้ไข
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>แก้ไขผู้ใช้ {user.displayName}</DialogTitle>
          </DialogHeader>

          <FormMessage error={error} />

          <UserFields
            idPrefix={idPrefix}
            units={units}
            defaults={{ displayName: user.displayName, unitId: user.unitId, position: user.position, role: user.role }}
            roleLocked={isSelf}
          />

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
