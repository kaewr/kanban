"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import { BOARD_COLUMNS, STATUS_LABEL } from "@/lib/board/constants";
import { positionBetween } from "@/lib/board/position";
import type { BoardCategory, BoardTask } from "@/lib/board/types";
import { useBoardStore } from "@/stores/board-store-provider";
import { TASK_STATUSES, type TaskStatus } from "@/types/domain";
import { BoardColumn, COLUMN_ID_PREFIX } from "./board-column";
import { DeleteTaskDialog } from "./delete-task-dialog";
import { TaskCardContent } from "./task-card";
import { TaskDialog, type TaskDialogMode } from "./task-dialog";

type Columns = Record<TaskStatus, BoardTask[]>;

function columnStatus(id: UniqueIdentifier): TaskStatus | null {
  const value = String(id);
  if (!value.startsWith(COLUMN_ID_PREFIX)) return null;
  const status = value.slice(COLUMN_ID_PREFIX.length);
  return (TASK_STATUSES as readonly string[]).includes(status) ? (status as TaskStatus) : null;
}

export function BoardView({ categories, years }: { categories: BoardCategory[]; years: number[] }) {
  const tasks = useBoardStore((s) => s.tasks);
  const snapshot = useBoardStore((s) => s.snapshot);
  const year = useBoardStore((s) => s.year);
  const moveTask = useBoardStore((s) => s.moveTask);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<TaskDialogMode | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Visible tasks per column, ordered by position.
  const columns = useMemo<Columns>(() => {
    const result = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as BoardTask[]])) as Columns;
    for (const task of Object.values(tasks)) {
      if (!task.isDeleted && task.year === year) result[task.status].push(task);
    }
    for (const status of TASK_STATUSES) result[status].sort((a, b) => a.position - b.position);
    return result;
  }, [tasks, year]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long press on touch so horizontal scrolling between columns still works (FR-08).
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: UniqueIdentifier) => tasks[String(id)]?.title ?? "";
  const placeOf = (id: UniqueIdentifier) => {
    const status = columnStatus(id) ?? tasks[String(id)]?.status;
    return status ? `คอลัมน์ ${STATUS_LABEL[status]}` : "";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `หยิบงาน ${titleOf(active.id)}`,
    onDragOver: ({ active, over }) =>
      over ? `งาน ${titleOf(active.id)} อยู่ที่${placeOf(over.id)}` : `งาน ${titleOf(active.id)} ไม่ได้อยู่เหนือคอลัมน์ใด`,
    onDragEnd: ({ active, over }) =>
      over ? `วางงาน ${titleOf(active.id)} ที่${placeOf(over.id)}` : `ยกเลิกการย้ายงาน ${titleOf(active.id)}`,
    onDragCancel: ({ active }) => `ยกเลิกการย้ายงาน ${titleOf(active.id)}`,
  };

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const task = tasks[String(active.id)];
    if (!task) return;

    const overTask = tasks[String(over.id)];
    const toStatus = columnStatus(over.id) ?? overTask?.status;
    if (!toStatus) return;

    const list = columns[toStatus].filter((t) => t.id !== task.id);
    let index = list.length; // dropped on the column itself -> end
    if (overTask && overTask.id !== task.id) {
      index = list.findIndex((t) => t.id === overTask.id);
      const dragged = active.rect.current.translated;
      const isBelow = dragged ? dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2 : false;
      if (isBelow) index += 1;
    } else if (overTask?.id === task.id) {
      return; // dropped on itself
    }

    const before = list[index - 1]?.position;
    const after = list[index]?.position;
    if (toStatus === task.status) {
      const current = columns[toStatus];
      const currentIndex = current.findIndex((t) => t.id === task.id);
      if (current[currentIndex - 1]?.position === before && current[currentIndex + 1]?.position === after) return;
    }
    moveTask(task.id, toStatus, positionBetween(before, after));
  }

  /** Card menu "ย้ายไป…": append to the end of the target column. */
  function moveToColumn(id: string, to: TaskStatus) {
    const list = columns[to].filter((t) => t.id !== id);
    moveTask(id, to, positionBetween(list[list.length - 1]?.position, undefined));
  }

  const activeTask = activeId ? tasks[activeId] : undefined;

  return (
    <>
      <DndContext
        id="board-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "กด Space หรือ Enter เพื่อหยิบงาน ใช้ปุ่มลูกศรเพื่อย้าย กด Space หรือ Enter อีกครั้งเพื่อวาง หรือกด Esc เพื่อยกเลิก",
          },
        }}
      >
        {/* Phones: one column per screen with snap scrolling; desktop: all five. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:snap-none md:px-0">
          {BOARD_COLUMNS.map((column) => (
            <BoardColumn
              key={column.status}
              status={column.status}
              label={column.label}
              hint={column.hint}
              tasks={columns[column.status]}
              snapshot={snapshot}
              categoryNames={categoryNames}
              onAdd={() => setDialog({ kind: "create", status: column.status })}
              onEdit={(id) => setDialog({ kind: "edit", taskId: id })}
              onDelete={setDeletingId}
              onMove={moveToColumn}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCardContent
              task={activeTask}
              categoryName={categoryNames.get(activeTask.categoryId) ?? ""}
              unsaved={false}
              className="rotate-1 shadow-lg"
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        mode={dialog}
        onClose={() => setDialog(null)}
        categories={categories}
        years={years}
      />
      <DeleteTaskDialog taskId={deletingId} onClose={() => setDeletingId(null)} />
    </>
  );
}
