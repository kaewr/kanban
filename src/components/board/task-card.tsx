"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarClockIcon,
  CircleCheckIcon,
  FlagIcon,
  LightbulbIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
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
import { PRIORITY_STYLE, STATUS_STYLE } from "./status-style";

const chip = "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset";

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
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl bg-card p-3 text-sm shadow-xs ring-1 ring-foreground/8 transition-[box-shadow,transform] duration-150",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 leading-snug font-medium break-words" data-testid="task-title">
          {task.title}
        </p>
        {menu}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn(chip, PRIORITY_STYLE[task.priority])}>
          <FlagIcon className="size-3" aria-hidden />
          {PRIORITY_LABEL[task.priority]}
        </span>
        <span className={cn(chip, "bg-primary/8 text-primary ring-primary/15")}>
          <TagIcon className="size-3" aria-hidden />
          {categoryName}
        </span>
        {unsaved && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold"
            data-testid="task-unsaved"
          >
            <span className="size-1.5 rounded-full bg-brand-gold" aria-hidden />
            ยังไม่บันทึก
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
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
              style={{ width: `${task.progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">{task.progress}%</span>
        </div>
      )}

      {(task.dueDate || task.startedAt || task.completedAt) && (
        <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed pt-2 text-xs text-muted-foreground tabular-nums">
          {task.dueDate && (
            <div className="flex items-center gap-1" title="กำหนดเสร็จ">
              <dt>
                <CalendarClockIcon className="size-3.5" aria-hidden />
                <span className="sr-only">กำหนด</span>
              </dt>
              <dd data-testid="task-due">{formatThaiDate(task.dueDate)}</dd>
            </div>
          )}
          {task.startedAt && (
            <div className="flex items-center gap-1" title="วันเริ่ม">
              <dt>
                <PlayIcon className="size-3.5" aria-hidden />
                <span className="sr-only">เริ่ม</span>
              </dt>
              <dd data-testid="task-started">{formatThaiDate(task.startedAt)}</dd>
            </div>
          )}
          {task.completedAt && (
            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400" title="วันเสร็จ">
              <dt>
                <CircleCheckIcon className="size-3.5" aria-hidden />
                <span className="sr-only">เสร็จ</span>
              </dt>
              <dd data-testid="task-completed">{formatThaiDate(task.completedAt)}</dd>
            </div>
          )}
        </dl>
      )}

      {suggestsLongTerm(task) && (
        <p
          className="flex items-start gap-1.5 rounded-lg bg-sky-50 px-2 py-1.5 text-xs text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
          data-testid="long-term-hint"
        >
          <LightbulbIcon className="mt-px size-3.5 shrink-0" aria-hidden />
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
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon aria-hidden />
          แก้ไข
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Fallback for moving without dragging (phones, keyboard, screen readers). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>ย้ายไป</DropdownMenuLabel>
          {BOARD_COLUMNS.filter((c) => c.status !== task.status).map((c) => {
            const Icon = STATUS_STYLE[c.status].icon;
            return (
              <DropdownMenuItem key={c.status} onClick={() => onMove(c.status)}>
                <Icon aria-hidden />
                {c.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2Icon aria-hidden />
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
        className="cursor-grab hover:-translate-y-px hover:shadow-md hover:ring-primary/25 active:cursor-grabbing"
      />
    </li>
  );
}
