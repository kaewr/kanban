"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { LEAVE_LABEL, LEAVE_NOTE_MAX, LEAVE_TYPES, validateLeave, workingDays, type LeaveErrors } from "@/lib/leave/rules";
import { saveLeave } from "./actions";

export type LeaveFormValue = {
  id?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  note: string;
};

/** BR-40: one day or a date range, with a short note. Used for adding and editing. */
export function LeaveForm({
  ownerId,
  initial,
  today,
  submitLabel = "บันทึกวันลา",
  onDone,
}: {
  ownerId: string;
  initial?: LeaveFormValue;
  today: string;
  submitLabel?: string;
  onDone?: () => void;
}) {
  const empty = { leaveType: "", startDate: today, endDate: today, note: "" };
  const [value, setValue] = useState<LeaveFormValue>(initial ?? empty);
  const [range, setRange] = useState(initial ? initial.startDate !== initial.endDate : false);
  const [fields, setFields] = useState<LeaveErrors>({});
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();
  const idPrefix = initial?.id ? `leave-${initial.id}` : "leave-new";

  const endDate = range ? value.endDate : value.startDate;
  const valid = value.startDate && endDate && endDate >= value.startDate;
  const days = valid ? workingDays(value.startDate, endDate) : 0;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { ...value, endDate };
    const errors = validateLeave(input);
    setFields(errors);
    setMessage({});
    if (Object.keys(errors).length > 0) return;
    startTransition(async () => {
      const result = await saveLeave({ ...input, ownerId });
      if (!result.ok) {
        setFields(result.fields ?? {});
        setMessage({ error: result.error });
        return;
      }
      setMessage({ success: "บันทึกวันลาแล้ว" });
      if (!initial) {
        setValue(empty);
        setRange(false);
      }
      onDone?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormMessage error={message.error} success={message.success} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-type`}>ประเภทการลา</Label>
          <NativeSelect
            id={`${idPrefix}-type`}
            value={value.leaveType}
            aria-invalid={fields.leaveType ? true : undefined}
            onChange={(e) => setValue({ ...value, leaveType: e.target.value })}
          >
            <option value="" disabled>
              เลือกประเภท
            </option>
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {LEAVE_LABEL[t]}
              </option>
            ))}
          </NativeSelect>
          {fields.leaveType && <p className="text-xs text-destructive">{fields.leaveType}</p>}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">ลา</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name={`${idPrefix}-range`} checked={!range} onChange={() => setRange(false)} className="accent-primary" />
              วันเดียว
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name={`${idPrefix}-range`} checked={range} onChange={() => setRange(true)} className="accent-primary" />
              หลายวัน (ช่วงวันที่)
            </label>
          </div>
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-start`}>{range ? "ตั้งแต่วันที่" : "วันที่ลา"}</Label>
          <Input
            id={`${idPrefix}-start`}
            type="date"
            value={value.startDate}
            aria-invalid={fields.startDate ? true : undefined}
            onChange={(e) => setValue({ ...value, startDate: e.target.value })}
          />
          {fields.startDate && <p className="text-xs text-destructive">{fields.startDate}</p>}
        </div>
        {range && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-end`}>ถึงวันที่</Label>
            <Input
              id={`${idPrefix}-end`}
              type="date"
              value={value.endDate}
              min={value.startDate}
              aria-invalid={fields.endDate ? true : undefined}
              onChange={(e) => setValue({ ...value, endDate: e.target.value })}
            />
          </div>
        )}
      </div>
      {fields.endDate && <p className="-mt-2 text-xs text-destructive">{fields.endDate}</p>}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-note`}>หมายเหตุ (ไม่บังคับ)</Label>
        <Textarea
          id={`${idPrefix}-note`}
          value={value.note}
          maxLength={LEAVE_NOTE_MAX}
          rows={2}
          placeholder="คำอธิบายสั้น ๆ เช่น ไปราชการที่กรุงเทพฯ"
          onChange={(e) => setValue({ ...value, note: e.target.value })}
        />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {value.note.length}/{LEAVE_NOTE_MAX}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" data-testid="leave-days-preview">
          รวม <span className="font-semibold tabular-nums">{days}</span> วันทำการ
          <span className="text-muted-foreground"> (ไม่นับเสาร์–อาทิตย์)</span>
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
