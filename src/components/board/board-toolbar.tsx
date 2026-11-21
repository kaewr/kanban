"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { changedTasks } from "@/lib/board/changes";
import { useBoardStore } from "@/stores/board-store-provider";
import type { YearType } from "@/types/domain";

function yearLabel(year: number, yearType: YearType): string {
  return yearType === "fiscal" ? `ปีงบประมาณ ${year}` : `พ.ศ. ${year}`;
}

export function BoardToolbar({ year, years, yearType }: { year: number; years: number[]; yearType: YearType }) {
  const router = useRouter();
  const tasks = useBoardStore((s) => s.tasks);
  const snapshot = useBoardStore((s) => s.snapshot);
  const changeCount = useMemo(() => changedTasks(tasks, snapshot).length, [tasks, snapshot]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h1 className="text-2xl font-semibold">บอร์ด</h1>

      {/* FR-12 */}
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">ปี</span>
        <NativeSelect
          aria-label="เลือกปี"
          className="w-auto"
          value={year}
          onChange={(e) => router.push(`/board?year=${e.target.value}`)}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {yearLabel(y, yearType)}
            </option>
          ))}
        </NativeSelect>
      </label>

      {/* FR-09 counter; saving arrives in M6 */}
      <div className="ml-auto flex items-center gap-3">
        <p role="status" aria-live="polite" data-testid="unsaved-count" className="text-sm text-muted-foreground">
          {changeCount > 0 ? `ยังไม่บันทึก ${changeCount} รายการ` : "ไม่มีรายการที่ยังไม่บันทึก"}
        </p>
        <Button disabled title="การบันทึกจะเปิดใช้ในเวอร์ชันถัดไป">
          บันทึก
        </Button>
      </div>
    </div>
  );
}
