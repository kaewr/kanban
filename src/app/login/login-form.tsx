"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// `next` is read from the URL at submit time (validated again on the server),
// so the form does not depend on request-time data.
function submitLogin(prev: LoginState, formData: FormData): Promise<LoginState> {
  formData.set("next", new URLSearchParams(window.location.search).get("next") ?? "");
  return login(prev, formData);
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(submitLogin, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="username">ชื่อผู้ใช้</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.username}
          required
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">ลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ</p>
    </form>
  );
}
