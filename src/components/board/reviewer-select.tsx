"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { groupByUnit, useReviewInfo } from "./review-context";

/** BR-53: pick one reviewer (anyone active except the owner), grouped by unit. */
export function ReviewerSelect({
  id,
  name,
  value,
  defaultValue,
  onChange,
}: {
  id: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (reviewerId: string) => void;
}) {
  const { candidates, nameOf } = useReviewInfo();
  const current = value ?? defaultValue ?? "";
  // A reviewer chosen earlier who is no longer active stays visible.
  const missing = current && !candidates.some((p) => p.id === current);

  return (
    <NativeSelect
      id={id}
      name={name}
      value={value}
      defaultValue={value === undefined ? defaultValue : undefined}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <option value="">ยังไม่ระบุผู้ตรวจ</option>
      {missing && <option value={current}>{nameOf(current)} (ปิดใช้งาน)</option>}
      {groupByUnit(candidates).map((g) => (
        <optgroup key={g.unit} label={g.unit}>
          {g.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      ))}
    </NativeSelect>
  );
}
