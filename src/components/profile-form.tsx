"use client";

import { useActionState } from "react";
import { updateOwnProfile, type ProfileFormState } from "@/app/actions/profile";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DISPLAY_NAME_MAX } from "@/lib/admin/users";
import type { YearType } from "@/types/domain";

const YEAR_OPTIONS: { value: YearType; label: string; hint: string }[] = [
  { value: "fiscal", label: "ปีงบประมาณ", hint: "เช่น ต.ค. 2569 – ก.ย. 2570 = ปีงบประมาณ 2570" },
  { value: "calendar", label: "ปี พ.ศ.", hint: "มกราคม – ธันวาคม" },
];

/** Own name and year type (BR-31). */
export function ProfileForm({ displayName, yearType }: { displayName: string; yearType: YearType }) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(updateOwnProfile, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">ชื่อ-นามสกุล</Label>
        <Input id="profile-name" name="displayName" defaultValue={displayName} maxLength={DISPLAY_NAME_MAX} required />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">แสดงปีของบอร์ดแบบ</legend>
        {YEAR_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-foreground/10 has-checked:bg-primary/5 has-checked:ring-primary/40"
          >
            <input
              type="radio"
              name="yearType"
              value={option.value}
              defaultChecked={yearType === option.value}
              className="mt-1 accent-primary"
            />
            <span className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
    </form>
  );
}
