"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatThaiWeekdayDate } from "@/lib/board/dates";
import { HOLIDAY_NAME_MAX, type Holiday } from "@/lib/holidays/rules";
import { ROUTES } from "@/lib/routes";
import { createHoliday, deleteHoliday, type HolidayActionResult } from "./actions";

export function HolidayManager({
  year,
  years,
  rangeLabel,
  range,
  holidays,
}: {
  year: number;
  years: number[];
  rangeLabel: string;
  range: { from: string; to: string };
  holidays: Holiday[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  function run(action: () => Promise<HolidayActionResult>, onSuccess?: () => void) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onSuccess?.();
      else setError(result.error);
    });
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () => createHoliday({ date, name }),
      () => {
        setDate("");
        setName("");
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">ปีงบประมาณ</span>
        <NativeSelect
          aria-label="เลือกปีงบประมาณ"
          className="w-auto"
          value={year}
          onChange={(e) => router.push(`${ROUTES.adminHolidays}?year=${e.target.value}`)}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              ปีงบประมาณ {y}
            </option>
          ))}
        </NativeSelect>
        <span className="text-muted-foreground">({rangeLabel})</span>
      </label>

      <form onSubmit={onCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="holiday-date">วันที่</Label>
          <Input
            id="holiday-date"
            type="date"
            value={date}
            min={range.from}
            max={range.to}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="holiday-name">ชื่อวันหยุด</Label>
          <Input
            id="holiday-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={HOLIDAY_NAME_MAX}
            placeholder="เช่น วันพืชมงคล"
            required
          />
        </div>
        <Button type="submit" disabled={pending} className="gap-1.5">
          <PlusIcon aria-hidden />
          เพิ่มวันหยุด
        </Button>
      </form>

      <FormMessage error={error} />

      {holidays.length === 0 ? (
        <p className="rounded-xl px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          ยังไม่มีวันหยุดในปีงบประมาณนี้
        </p>
      ) : (
        <ol
          className="flex flex-col divide-y overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10"
          aria-busy={pending}
          data-testid="holiday-list"
        >
          {holidays.map((h) => (
            <li key={h.id} data-holiday={h.date} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-40 shrink-0 text-sm text-muted-foreground tabular-nums">{formatThaiWeekdayDate(h.date)}</span>
              <span className="min-w-0 flex-1 font-medium">{h.name}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`ลบวันหยุด ${h.name}`}
                disabled={pending}
                onClick={() => run(() => deleteHoliday(h.id))}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
