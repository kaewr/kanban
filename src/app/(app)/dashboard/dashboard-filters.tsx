"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { ROUTES } from "@/lib/routes";

type Option = { id: string; name: string; unitId?: string | null };

/** Year for everyone; unit and person for admins (FR-16). Values live in the URL. */
export function DashboardFilters({
  year,
  years,
  yearLabel,
  unitId,
  userId,
  units,
  people,
}: {
  year: number;
  years: { value: number; label: string }[];
  yearLabel: string;
  unitId: string;
  userId: string;
  units: Option[] | null;
  people: Option[] | null;
}) {
  const router = useRouter();
  const go = (next: { year?: number; unit?: string; user?: string }) => {
    const params = new URLSearchParams();
    params.set("year", String(next.year ?? year));
    const unit = next.unit ?? unitId;
    const user = next.user ?? userId;
    if (unit) params.set("unit", unit);
    if (user) params.set("user", user);
    router.push(`${ROUTES.dashboard}?${params}`);
  };
  const visiblePeople = people?.filter((p) => !unitId || p.unitId === unitId) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label={yearLabel}
        className="w-auto"
        value={year}
        onChange={(e) => go({ year: Number(e.target.value) })}
      >
        {years.map((y) => (
          <option key={y.value} value={y.value}>
            {y.label}
          </option>
        ))}
      </NativeSelect>

      {units && (
        <NativeSelect
          aria-label="สังกัดงาน"
          className="w-auto"
          value={unitId}
          onChange={(e) => go({ unit: e.target.value, user: "" })}
        >
          <option value="">ทุกสังกัด</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </NativeSelect>
      )}

      {visiblePeople && (
        <NativeSelect
          aria-label="บุคคล"
          className="w-auto max-w-56"
          value={userId}
          onChange={(e) => go({ user: e.target.value })}
        >
          <option value="">ทุกคน</option>
          {visiblePeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}
