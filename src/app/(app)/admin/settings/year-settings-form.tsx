"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { currentBoardYear, fiscalRangeLabel, THAI_MONTHS } from "@/lib/board/year";
import { updateFiscalStartMonth } from "./actions";

/** FR-19 (changed 22 Nov 2026): only the fiscal start month is shared. */
export function YearSettingsForm(props: { fiscalStartMonth: number }) {
  const [month, setMonth] = useState(props.fiscalStartMonth);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; success?: string }>({});

  const fiscalYear = currentBoardYear({ yearType: "fiscal", fiscalStartMonth: month });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({});
    startTransition(async () => {
      const res = await updateFiscalStartMonth(month);
      setResult(res.ok ? { success: "บันทึกการตั้งค่าแล้ว" } : { error: res.error });
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormMessage error={result.error} success={result.success} />

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

      <p className="text-sm" data-testid="year-preview">
        ปีงบประมาณปัจจุบัน <span className="font-semibold">{fiscalYear}</span>{" "}
        <span className="text-muted-foreground">({fiscalRangeLabel(fiscalYear, month)})</span>
      </p>

      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        การเปลี่ยนเดือนเริ่มมีผลกับปีเริ่มต้นของบอร์ดและ Dashboard เท่านั้น งานที่มีอยู่แล้วยังอยู่ในปีเดิมที่บันทึกไว้
      </p>

      <div>
        <Button type="submit" disabled={pending || month === props.fiscalStartMonth}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
    </form>
  );
}
