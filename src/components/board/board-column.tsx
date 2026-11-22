"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTaskChanged } from "@/lib/board/changes";
import { WIP_LIMIT } from "@/lib/board/constants";
import { dueState, exceedsWipLimit } from "@/lib/board/rules";
import type { BoardTask } from "@/lib/board/types";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/domain";
import { STATUS_STYLE } from "./status-style";
import { SortableTaskCard } from "./task-card";

export const COLUMN_ID_PREFIX = "column:";

type Props = {
  status: TaskStatus;
  label: string;
  hint: string;
  /** Tasks shown (after FR-14 filters). */
  tasks: BoardTask[];
  /** All tasks of the column, for the WIP warning (BR-08) which ignores filters. */
  totalCount: number;
  today: string;
  snapshot: Record<string, BoardTask>;
  categoryNames: Map<string, string>;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, to: TaskStatus) => void;
  /** "เสร็จแล้ว" shows only the latest tasks until expanded. */
  preview?: { hidden: number; expanded: boolean; onToggle: () => void };
};

export function BoardColumn({
  status,
  label,
  hint,
  tasks,
  totalCount,
  today,
  snapshot,
  categoryNames,
  onAdd,
  onEdit,
  onDelete,
  onMove,
  preview,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_ID_PREFIX}${status}` });
  const wip = status === "in_progress" && exceedsWipLimit(totalCount); // BR-08
  const filtered = tasks.length !== totalCount;
  const style = STATUS_STYLE[status];
  const Icon = style.icon;

  return (
    <section
      aria-label={label}
      data-status={status}
      className={cn(
        // Fits the screen; the card list scrolls inside so the header and "+ เพิ่มงาน" stay visible.
        "flex max-h-[max(24rem,calc(100dvh-14rem))] w-[85vw] max-w-sm shrink-0 snap-center flex-col rounded-2xl md:w-auto md:max-w-none md:min-w-52 md:flex-1",
        style.column,
      )}
    >
      <header className="flex flex-col gap-1.5 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className={cn("inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold", style.pill)}>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </h2>
          <span
            className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums ring-1 ring-foreground/5"
            aria-label={filtered ? `แสดง ${tasks.length} จาก ${totalCount} งาน` : `${tasks.length} งาน`}
          >
            {filtered ? `${tasks.length}/${totalCount}` : tasks.length}
          </span>
        </div>
        <p className="px-1 text-xs text-muted-foreground">{hint}</p>
        {wip && (
          <p
            role="status"
            data-testid="wip-warning"
            className="flex items-start gap-1.5 rounded-lg bg-amber-100 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          >
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            มีงานกำลังทำเกิน {WIP_LIMIT} งาน ลองปิดงานที่ค้างก่อนเริ่มงานใหม่
          </p>
        )}
      </header>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ol
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain rounded-lg px-2 pt-0.5 pb-2 transition-colors",
            isOver && cn("bg-background/40 ring-2", style.dropRing),
          )}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              categoryName={categoryNames.get(task.categoryId) ?? "—"}
              unsaved={task.isNew || isTaskChanged(task, snapshot[task.id])}
              due={dueState(task, today)}
              onEdit={() => onEdit(task.id)}
              onDelete={() => onDelete(task.id)}
              onMove={(to) => onMove(task.id, to)}
            />
          ))}
        </ol>
      </SortableContext>

      {/* BR-01: add at the bottom of every column */}
      <div className="flex flex-col gap-1 px-2 pb-2">
        {preview && (preview.hidden > 0 || preview.expanded) && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1 text-muted-foreground hover:bg-background/70 hover:text-foreground"
            onClick={preview.onToggle}
            data-testid="done-preview-toggle"
          >
            {preview.expanded ? (
              <>
                <ChevronUpIcon aria-hidden />
                แสดงเฉพาะงานล่าสุด
              </>
            ) : (
              <>
                <ChevronDownIcon aria-hidden />
                แสดงทั้งหมด ({totalCount})
              </>
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-1.5 text-muted-foreground hover:bg-background/70 hover:text-foreground"
          onClick={onAdd}
          aria-label={`เพิ่มงานใน ${label}`}
        >
          <PlusIcon aria-hidden />
          เพิ่มงาน
        </Button>
      </div>
    </section>
  );
}
