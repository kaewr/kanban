"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { callAdminApi } from "@/lib/admin/client";

/** FR-04: create a user with a role. */
export function CreateUserDialog() {
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
      username: form.get("username"),
      displayName: form.get("displayName"),
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
      <DialogTrigger render={<Button />}>+ เพิ่มผู้ใช้</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>เพิ่มผู้ใช้</DialogTitle>
            <DialogDescription>
              ผู้ใช้ใหม่เข้าสู่ระบบด้วยรหัสผ่านเริ่มต้น และจะเห็นแถบเตือนให้เปลี่ยนรหัสผ่าน
            </DialogDescription>
          </DialogHeader>

          <FormMessage error={error} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-username">ชื่อผู้ใช้</Label>
            <Input
              id="new-username"
              name="username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              pattern="[A-Za-z0-9._]{3,30}"
              title="a-z 0-9 . _ ยาว 3–30 ตัวอักษร"
              required
            />
            <p className="text-xs text-muted-foreground">a-z 0-9 . _ ยาว 3–30 ตัวอักษร แก้ภายหลังไม่ได้</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-display-name">ชื่อที่แสดง</Label>
            <Input id="new-display-name" name="displayName" maxLength={100} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-role">บทบาท</Label>
            <NativeSelect id="new-role" name="role" defaultValue="user">
              <option value="user">ผู้ใช้งาน</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </NativeSelect>
          </div>

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
