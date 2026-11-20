"use client";

import { useActionState, useEffect, useRef } from "react";
import { changeOwnPassword, changeRequiredPassword, type FormState } from "@/app/actions/auth";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * mode "required": forced change after first login (FR-02), no current password.
 * mode "self": change from the profile page (FR-03), current password required.
 */
export function PasswordForm({ mode }: { mode: "required" | "self" }) {
  const action = mode === "required" ? changeRequiredPassword : changeOwnPassword;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />

      {mode === "self" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="currentPassword">รหัสผ่านปัจจุบัน</Label>
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        </div>
      )}

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
