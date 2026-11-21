"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { isTaskChanged } from "@/lib/board/changes";
import { WIP_LIMIT } from "@/lib/board/constants";
import { exceedsWipLimit } from "@/lib/board/rules";
import type { BoardTask } from "@/lib/board/types";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/domain";
import { SortableTaskCard } from "./task-card";

export const COLUMN_ID_PREFIX = "column:";

type Props = {
  status: TaskStatus;
  label: string;
  hint: string;
  tasks: BoardTask[];
  snapshot: Record<string, BoardTask>;
  categoryNames: Map<string, string>;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, to: TaskStatus) => void;
};

export function BoardColumn({ status, label, hint, tasks, snapshot, categoryNames, onAdd, onEdit, onDelete, onMove }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_ID_PREFIX}${status}` });
  const wip = status === "in_progress" && exceedsWipLimit(tasks.length); // BR-08

  return (
    <section
      aria-label={label}
      data-status={status}
      className="flex w-[85vw] max-w-sm shrink-0 snap-center flex-col rounded-xl bg-muted/50 md:w-auto md:max-w-none md:min-w-52 md:flex-1"
    >
      <header className="flex flex-col gap-1 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{label}</h2>
          <span className="rounded-full bg-background px-2 text-xs text-muted-foreground" aria-label={`${tasks.length} งาน`}>
            {tasks.length}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {wip && (
          <p role="status" data-testid="wip-warning" className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            มีงานกำลังทำเกิน {WIP_LIMIT} งาน ลองปิดงานที่ค้างก่อนเริ่มงานใหม่
          </p>
        )}
      </header>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ol
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 rounded-lg px-2 pb-2 transition-colors",
            isOver && "bg-primary/5 ring-2 ring-primary/30",
          )}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              categoryName={categoryNames.get(task.categoryId) ?? "—"}
              unsaved={task.isNew || isTaskChanged(task, snapshot[task.id])}
              onEdit={() => onEdit(task.id)}
              onDelete={() => onDelete(task.id)}
              onMove={(to) => onMove(task.id, to)}
            />
          ))}
        </ol>
      </SortableContext>

      {/* BR-01: add at the bottom of every column */}
      <div className="px-2 pb-2">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={onAdd} aria-label={`เพิ่มงานใน ${label}`}>
          + เพิ่มงาน
        </Button>
      </div>
    </section>
  );
}
