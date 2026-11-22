"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { ROUTES } from "@/lib/routes";
import type { UnitOption } from "./types";

export function UnitFilter({ units, value }: { units: UnitOption[]; value: string }) {
  const router = useRouter();
  return (
    <NativeSelect
      aria-label="กรองตามสังกัดงาน"
      className="w-auto"
      value={value}
      onChange={(e) =>
        router.push(e.target.value ? `${ROUTES.adminUsers}?unit=${e.target.value}` : ROUTES.adminUsers)
      }
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
