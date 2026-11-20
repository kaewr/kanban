"use client";

import { useActionState, useEffect, useRef } from "react";
import { changeOwnPassword, type FormState } from "@/app/actions/auth";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Change own password (FR-03); current password required. */
export function PasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(changeOwnPassword, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">รหัสผ่านปัจจุบัน</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">รหัสผ่านใหม่</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={6} required />
        <p className="text-xs text-muted-foreground">อย่างน้อย 6 ตัวอักษร และห้ามใช้รหัสผ่านเริ่มต้น</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required />
      </div>

      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
      </Button>
    </form>
  );
}
