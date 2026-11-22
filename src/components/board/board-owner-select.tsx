"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import type { BoardOwner } from "@/lib/board/load";
import { boardHref } from "@/lib/routes";
import { useConfirmLeave } from "./unsaved-guard";

/** FR-11 (admin): switch to another user's board. FR-10 asks first when there are unsaved changes. */
export function BoardOwnerSelect({
  owners,
  viewer,
  ownerId,
  year,
}: {
  owners: BoardOwner[];
  viewer: { id: string; username: string };
  ownerId: string;
  year: number;
}) {
  const router = useRouter();
  const confirmLeave = useConfirmLeave();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">บอร์ดของ</span>
      <NativeSelect
        aria-label="เลือกบอร์ดของผู้ใช้"
        className="w-auto max-w-56"
        value={ownerId}
        onChange={(e) => {
          const target = owners.find((o) => o.id === e.target.value);
          if (!target) return;
          const href = boardHref({ user: target.id === viewer.id ? undefined : target.username, year });
          confirmLeave(() => router.push(href));
        }}
      >
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.id === viewer.id ? `ฉัน (${o.displayName})` : o.displayName}
            {o.id !== viewer.id && o.position ? ` · ${o.position}` : ""}
            {o.isActive === false ? " · ปิดใช้งาน" : ""}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
