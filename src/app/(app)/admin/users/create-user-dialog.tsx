"use client";

import { UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { callAdminApi } from "@/lib/admin/client";
import type { UnitOption } from "./types";
import { UserFields } from "./user-fields";

/** FR-04: create a user with unit, position and role. The username is generated. */
export function CreateUserDialog({ units }: { units: UnitOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const result = await callAdminApi("/api/admin/users", "POST", {
      displayName: form.get("displayName"),
      unitId: form.get("unitId"),
      position: form.get("position"),
      role: form.get("role"),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
    >
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <UserPlusIcon aria-hidden />
        เพิ่มผู้ใช้
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>เพิ่มผู้ใช้</DialogTitle>
            <DialogDescription>
              ผู้ใช้ใหม่เข้าสู่ระบบด้วยรหัสผ่านเริ่มต้น และจะเห็นแถบเตือนให้เปลี่ยนรหัสผ่าน
            </DialogDescription>
          </DialogHeader>

          <FormMessage error={error} />

          <UserFields idPrefix="new" units={units} />

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>ยกเลิก</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก…" : "สร้างผู้ใช้"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
