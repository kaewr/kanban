"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTaskChanged } from "@/lib/board/changes";
import { COLUMN_PAGE_SIZE } from "@/lib/board/filter";
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
  /** Cards shown (after FR-14 filters and paging). */
  tasks: BoardTask[];
  /** All cards of the column, for the counter and the WIP warning (BR-08). */
  totalCount: number;
  today: string;
  snapshot: Record<string, BoardTask>;
  categoryNames: Map<string, string>;
  /** A dragged card would land in this column if released now. */
  dropTarget: boolean;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, to: TaskStatus) => void;
  /** Paging: cards still hidden; null while a filter shows every match. */
  paging: { hidden: number; canCollapse: boolean; onMore: () => void; onCollapse: () => void } | null;
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
  dropTarget,
  onAdd,
  onEdit,
  onDelete,
  onMove,
  paging,
}: Props) {
  // The whole column (header included) accepts drops.
  const { setNodeRef } = useDroppable({ id: `${COLUMN_ID_PREFIX}${status}` });
  const wip = status === "in_progress" && exceedsWipLimit(totalCount); // BR-08
  const partial = tasks.length !== totalCount;
  const style = STATUS_STYLE[status];
  const Icon = style.icon;

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      data-status={status}
      data-drop-target={dropTarget || undefined}
      className={cn(
        // Height follows the cards, at most the screen; the cards scroll inside on their own.
        "flex max-h-[max(22rem,calc(100dvh-15rem))] w-[85vw] max-w-sm shrink-0 snap-center flex-col rounded-2xl transition-[box-shadow,filter] duration-150 md:w-auto md:max-w-none md:min-w-52 md:flex-1",
        style.column,
        // Glow when releasing would drop the card here.
        dropTarget && cn("shadow-lg ring-2 brightness-[1.03] dark:brightness-125", style.dropRing, style.glow),
      )}
    >
      <header className="flex flex-col gap-1.5 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2
            className={cn(
              "inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold",
              style.pill,
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </h2>
          <span
            className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums ring-1 ring-foreground/5"
            aria-label={partial ? `แสดง ${tasks.length} จาก ${totalCount} งาน` : `${tasks.length} งาน`}
          >
            {partial ? `${tasks.length}/${totalCount}` : tasks.length}
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
        {/* BR-01: add in every column — at the top so it is always at hand */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-1.5 bg-background/50 text-muted-foreground hover:bg-background/80 hover:text-foreground"
          onClick={onAdd}
          aria-label={`เพิ่มงานใน ${label}`}
        >
          <PlusIcon aria-hidden />
          เพิ่มงาน
        </Button>
      </header>

      {/* Scrolls on its own when the column is taller than the screen (thin bar on hover). */}
      <div data-testid="column-drop" className="scroll-thin flex min-h-16 flex-col overflow-y-auto overscroll-contain">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2 px-2 pt-1 pb-2">
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

        {paging && (paging.hidden > 0 || paging.canCollapse) && (
          <div className="flex flex-col gap-1 px-2 pb-2">
            {paging.hidden > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                onClick={paging.onMore}
                data-testid="column-more"
              >
                <ChevronDownIcon aria-hidden />
                แสดงเพิ่มอีก {Math.min(COLUMN_PAGE_SIZE, paging.hidden)} (เหลือ {paging.hidden})
              </Button>
            )}
            {paging.canCollapse && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                onClick={paging.onCollapse}
                data-testid="column-collapse"
              >
                <ChevronUpIcon aria-hidden />
                ย่อกลับ
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
