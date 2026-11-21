"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BOARD_COLUMNS, PRIORITY_LABEL } from "@/lib/board/constants";
import { formatThaiDate } from "@/lib/board/dates";
import { suggestsLongTerm } from "@/lib/board/rules";
import type { BoardTask } from "@/lib/board/types";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/domain";

const PRIORITY_VARIANT = { 1: "destructive", 2: "secondary", 3: "outline" } as const;

type ContentProps = {
  task: BoardTask;
  categoryName: string;
  unsaved: boolean;
  className?: string;
  menu?: React.ReactNode;
};

/** Presentational card, also used for the drag overlay. */
export function TaskCardContent({ task, categoryName, unsaved, className, menu }: ContentProps) {
  const showProgress = task.status === "long_term" && task.progress !== null;

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg bg-background p-3 text-sm ring-1 ring-foreground/10", className)}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-medium break-words" data-testid="task-title">
          {task.title}
        </p>
        {menu}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Badge variant={PRIORITY_VARIANT[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
        <Badge variant="outline">{categoryName}</Badge>
        {unsaved && (
          <span className="text-xs text-amber-700 dark:text-amber-400" data-testid="task-unsaved">
            • ยังไม่บันทึก
          </span>
        )}
      </div>

      {showProgress && (
        <div className="flex items-center gap-2">
          <div
            role="progressbar"
            aria-label="ความคืบหน้า"
            aria-valuenow={task.progress ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary" style={{ width: `${task.progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{task.progress}%</span>
        </div>
      )}

      {(task.dueDate || task.startedAt || task.completedAt) && (
        <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {task.dueDate && (
            <div className="flex gap-1">
              <dt>กำหนด</dt>
              <dd data-testid="task-due">{formatThaiDate(task.dueDate)}</dd>
            </div>
          )}
          {task.startedAt && (
            <div className="flex gap-1">
              <dt>เริ่ม</dt>
              <dd data-testid="task-started">{formatThaiDate(task.startedAt)}</dd>
            </div>
          )}
          {task.completedAt && (
            <div className="flex gap-1">
              <dt>เสร็จ</dt>
              <dd data-testid="task-completed">{formatThaiDate(task.completedAt)}</dd>
            </div>
          )}
        </dl>
      )}

      {suggestsLongTerm(task) && (
        <p className="text-xs text-sky-700 dark:text-sky-400" data-testid="long-term-hint">
          กำหนดเสร็จเกิน 30 วัน ลองย้ายไป &ldquo;งานระยะยาว&rdquo;
        </p>
      )}
    </div>
  );
}

type SortableProps = {
  task: BoardTask;
  categoryName: string;
  unsaved: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (to: TaskStatus) => void;
};

export function SortableTaskCard({ task, categoryName, unsaved, onEdit, onDelete, onMove }: SortableProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  // React events bubble out of portals to the card, so stop them here: the menu must
  // neither start a drag nor open the edit dialog.
  const menu = (
    <span
      className="contents"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-xs" aria-label={`ตัวเลือกงาน ${task.title}`} />}
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>แก้ไข</DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Fallback for moving without dragging (phones, keyboard, screen readers). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>ย้ายไป</DropdownMenuLabel>
          {BOARD_COLUMNS.filter((c) => c.status !== task.status).map((c) => (
            <DropdownMenuItem key={c.status} onClick={() => onMove(c.status)}>
              {c.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          ลบงาน
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </span>
  );

  return (
    <li
      ref={setNodeRef}
      data-task-id={task.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      aria-roledescription="การ์ดงานที่ลากได้"
      aria-label={task.title}
      onClick={onEdit}
    >
      <TaskCardContent
        task={task}
        categoryName={categoryName}
        unsaved={unsaved}
        menu={menu}
        className="cursor-grab hover:ring-foreground/25 active:cursor-grabbing"
      />
    </li>
  );
}
