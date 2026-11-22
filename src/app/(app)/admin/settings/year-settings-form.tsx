"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { currentBoardYear, yearLabel } from "@/lib/board/year";
import type { YearType } from "@/types/domain";
import { updateYearSettings } from "./actions";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const OPTIONS: { value: YearType; label: string; hint: string }[] = [
  { value: "calendar", label: "ปีปฏิทิน", hint: "มกราคม – ธันวาคม" },
  { value: "fiscal", label: "ปีงบประมาณ", hint: "เรียกตามปีที่สิ้นสุด เช่น ต.ค. 2569 – ก.ย. 2570 = ปีงบ 2570" },
];

/** FR-19 / BR-10 */
export function YearSettingsForm(props: { yearType: YearType; fiscalStartMonth: number }) {
  const [yearType, setYearType] = useState(props.yearType);
  const [month, setMonth] = useState(props.fiscalStartMonth);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; success?: string }>({});

  const dirty = yearType !== props.yearType || month !== props.fiscalStartMonth;
  const preview = yearLabel(currentBoardYear({ yearType, fiscalStartMonth: month }), yearType);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({});
    startTransition(async () => {
      const res = await updateYearSettings(yearType, month);
      setResult(res.ok ? { success: "บันทึกการตั้งค่าแล้ว" } : { error: res.error });
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormMessage error={result.error} success={result.success} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">รูปแบบปี</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-foreground/10 has-checked:bg-muted/60 has-checked:ring-foreground/30"
          >
            <input
              type="radio"
              name="yearType"
              value={option.value}
              checked={yearType === option.value}
              onChange={() => setYearType(option.value)}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {yearType === "fiscal" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="fiscal-start-month">เดือนเริ่มปีงบประมาณ</Label>
          <NativeSelect
            id="fiscal-start-month"
            className="w-auto"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {THAI_MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <p className="text-sm" data-testid="year-preview">
        ปีปัจจุบันของบอร์ดจะเป็น <span className="font-semibold">{preview}</span>
      </p>

      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        การเปลี่ยนรูปแบบปีมีผลกับปีเริ่มต้นของบอร์ด งานใหม่ และ Dashboard เท่านั้น
        งานที่มีอยู่แล้วยังอยู่ในปีเดิมที่บันทึกไว้ ไม่ถูกคำนวณใหม่
      </p>

      <div>
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
    </form>
  );
}
