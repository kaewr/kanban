"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { LoginGroup } from "@/lib/accounts";

// `next` is read from the URL at submit time (validated again on the server).
function submitLogin(prev: LoginState, formData: FormData): Promise<LoginState> {
  formData.set("next", new URLSearchParams(window.location.search).get("next") ?? "");
  return login(prev, formData);
}

/** BR-20: pick your Thai name from the list (grouped by unit), then type the password. */
export function LoginForm({ groups }: { groups: LoginGroup[] }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(submitLogin, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="userId">ชื่อผู้ใช้</Label>
        <NativeSelect id="userId" name="userId" defaultValue={state.userId ?? ""} required className="h-9" key={state.userId}>
          <option value="" disabled>
            เลือกชื่อของคุณ
          </option>
          {groups.map((group) => (
            <optgroup key={group.unit} label={group.unit}>
              {group.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-9" />
      </div>

      <Button type="submit" disabled={pending} className="mt-2 h-9">
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">ลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ</p>
    </form>
  );
}

export function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="กำลังโหลดรายชื่อ">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-9 animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
      <div className="mt-2 h-9 animate-pulse rounded-lg bg-primary/30" />
    </div>
  );
}
