"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { changedTasks } from "@/lib/board/changes";
import type { BoardOwner } from "@/lib/board/load";
import { yearLabel } from "@/lib/board/year";
import { boardHref } from "@/lib/routes";
import { useBoardStore } from "@/stores/board-store-provider";
import type { YearType } from "@/types/domain";
import { BoardOwnerSelect } from "./board-owner-select";
import { ConflictDialog } from "./conflict-dialog";
import { useConfirmLeave } from "./unsaved-guard";
import { useBoardSave } from "./use-board-save";

export function BoardToolbar({
  year,
  years,
  yearType,
  ownerParam,
  owners,
  viewer,
  ownerId,
}: {
  year: number;
  years: number[];
  yearType: YearType;
  /** username in the URL when an admin is on someone else's board */
  ownerParam: string | undefined;
  owners: BoardOwner[];
  viewer: { id: string; username: string };
  ownerId: string;
}) {
  const router = useRouter();
  const confirmLeave = useConfirmLeave();
  const tasks = useBoardStore((s) => s.tasks);
  const snapshot = useBoardStore((s) => s.snapshot);
  const changeCount = useMemo(() => changedTasks(tasks, snapshot).length, [tasks, snapshot]);
  const { status, save, conflicts, reloading, reloadConflicts, dismissConflicts } = useBoardSave();

  const saving = status === "saving";
  let message = "ไม่มีรายการที่ยังไม่บันทึก";
  if (saving) message = "กำลังบันทึก…";
  else if (changeCount > 0) message = `ยังไม่บันทึก ${changeCount} รายการ`;
  else if (status === "saved") message = "บันทึกแล้ว";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h1 className="text-2xl font-semibold">บอร์ด</h1>

      {owners.length > 0 && <BoardOwnerSelect owners={owners} viewer={viewer} ownerId={ownerId} year={year} />}

      {/* FR-12; FR-10 asks first when there are unsaved changes */}
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">ปี</span>
        <NativeSelect
          aria-label="เลือกปี"
          className="w-auto"
          value={year}
          onChange={(e) => {
            const target = boardHref({ user: ownerParam, year: Number(e.target.value) });
            confirmLeave(() => router.push(target));
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {yearLabel(y, yearType)}
            </option>
          ))}
        </NativeSelect>
      </label>

      {/* FR-09 */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        {status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </p>
        )}
        <p role="status" aria-live="polite" data-testid="unsaved-count" className="text-sm text-muted-foreground">
          {message}
        </p>
        <Button onClick={save} disabled={changeCount === 0 || saving}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>

      <ConflictDialog
        conflicts={conflicts}
        reloading={reloading}
        onReload={reloadConflicts}
        onDismiss={dismissConflicts}
      />
    </div>
  );
}
