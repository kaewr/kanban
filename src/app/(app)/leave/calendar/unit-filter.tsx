"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { ROUTES } from "@/lib/routes";

/** Admin only: narrow the calendar to one unit. */
export function UnitFilter({
  month,
  unit,
  units,
}: {
  month: string;
  unit: string | null;
  units: { id: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <NativeSelect
      aria-label="สังกัดงาน"
      className="w-auto max-w-60"
      value={unit ?? ""}
      onChange={(e) => {
        const query = new URLSearchParams({ month });
        if (e.target.value) query.set("unit", e.target.value);
        router.push(`${ROUTES.leaveCalendar}?${query}`);
      }}
    >
      <option value="">ทุกสังกัด</option>
      {units.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </NativeSelect>
  );
}
