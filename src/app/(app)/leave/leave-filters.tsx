"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

/** Year for everyone; whose leave for admins (BR-44). */
export function LeaveFilters({
  year,
  years,
  ownerId,
  viewerId,
  owners,
}: {
  year: number;
  years: { value: number; label: string }[];
  ownerId: string;
  viewerId: string;
  owners: { id: string; name: string }[] | null;
}) {
  const router = useRouter();
  const go = (next: { year?: number; user?: string }) => {
    const params = new URLSearchParams({ year: String(next.year ?? year) });
    const user = next.user ?? ownerId;
    if (user !== viewerId) params.set("user", user);
    router.push(`/leave?${params}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {owners && (
        <NativeSelect
          aria-label="วันลาของ"
          className="w-auto max-w-60"
          value={ownerId}
          onChange={(e) => go({ user: e.target.value })}
        >
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.id === viewerId ? `ฉัน (${o.name})` : o.name}
            </option>
          ))}
        </NativeSelect>
      )}
      <NativeSelect aria-label="เลือกปี" className="w-auto" value={year} onChange={(e) => go({ year: Number(e.target.value) })}>
        {years.map((y) => (
          <option key={y.value} value={y.value}>
            {y.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
