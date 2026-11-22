"use client";

import { PencilIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { FormMessage } from "@/components/form-message";
import { LeaveTypeBadge } from "@/components/leave/leave-type-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatThaiDate } from "@/lib/board/dates";
import { workingDays, type LeaveType } from "@/lib/leave/rules";
import { cancelLeave } from "./actions";
import { LeaveForm } from "./leave-form";

export type LeaveRow = {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  note: string | null;
  createdByOther: string | null; // name when someone else (admin) recorded it
};

function rangeLabel(row: LeaveRow): string {
  return row.startDate === row.endDate
    ? formatThaiDate(row.startDate)
    : `${formatThaiDate(row.startDate)} – ${formatThaiDate(row.endDate)}`;
}

export function LeaveList({ rows, ownerId, today }: { rows: LeaveRow[]; ownerId: string; today: string }) {
  const [editing, setEditing] = useState<LeaveRow | null>(null);
  const [cancelling, setCancelling] = useState<LeaveRow | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีวันลาในปีนี้</p>;
  }

  return (
    <>
      <ul className="flex flex-col divide-y" data-testid="leave-list">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3" data-leave={row.id}>
            <LeaveTypeBadge type={row.leaveType} />
            <span className="font-medium tabular-nums">{rangeLabel(row)}</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {workingDays(row.startDate, row.endDate)} วัน
            </span>
            <div className="ml-auto flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`แก้ไขวันลา ${rangeLabel(row)}`}
                onClick={() => setEditing(row)}
              >
                <PencilIcon aria-hidden />
                แก้ไข
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                aria-label={`ยกเลิกวันลา ${rangeLabel(row)}`}
                onClick={() => {
                  setError(undefined);
                  setCancelling(row);
                }}
              >
                <XIcon aria-hidden />
                ยกเลิก
              </Button>
            </div>
            {(row.note || row.createdByOther) && (
              <p className="w-full text-sm text-muted-foreground">
                {row.note}
                {row.createdByOther && (
                  <span className="text-xs">
                    {row.note ? " · " : ""}บันทึกโดย {row.createdByOther}
                  </span>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขวันลา</DialogTitle>
          </DialogHeader>
          {editing && (
            <LeaveForm
              ownerId={ownerId}
              today={today}
              initial={{
                id: editing.id,
                leaveType: editing.leaveType,
                startDate: editing.startDate,
                endDate: editing.endDate,
                note: editing.note ?? "",
              }}
              submitLabel="บันทึกการแก้ไข"
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยกเลิกวันลา</DialogTitle>
            <DialogDescription>
              {cancelling && `ยกเลิกวันลาวันที่ ${rangeLabel(cancelling)} ใช่หรือไม่`}
            </DialogDescription>
          </DialogHeader>
          <FormMessage error={error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>ไม่ยกเลิก</DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (!cancelling) return;
                  const result = await cancelLeave(cancelling.id);
                  if (result.ok) setCancelling(null);
                  else setError(result.error);
                })
              }
            >
              ยกเลิกวันลา
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
