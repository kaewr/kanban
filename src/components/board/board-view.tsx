"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragOverEvent,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import { BOARD_COLUMNS, STATUS_LABEL } from "@/lib/board/constants";
import { bangkokDate } from "@/lib/board/dates";
import { isTaskChanged } from "@/lib/board/changes";
import {
  COLUMN_PAGE_SIZE,
  EMPTY_FILTER,
  isFilterActive,
  matchesFilter,
  pageColumn,
  type BoardFilter,
} from "@/lib/board/filter";
import { positionBetween } from "@/lib/board/position";
import { dueState } from "@/lib/board/rules";
import type { BoardCategory, BoardTask } from "@/lib/board/types";
import { useBoardStore } from "@/stores/board-store-provider";
import { TASK_STATUSES, type TaskStatus } from "@/types/domain";
import { BoardColumn, COLUMN_ID_PREFIX } from "./board-column";
import { BoardFilters } from "./board-filters";
import { DeleteTaskDialog } from "./delete-task-dialog";
import { TaskCardContent } from "./task-card";
import { TaskDialog, type TaskDialogMode } from "./task-dialog";
import { CardDensityToggle } from "./card-density-toggle";
import { useCardDensity } from "./use-card-density";

type Columns = Record<TaskStatus, BoardTask[]>;

/**
 * Where a dragged card lands is decided by the pointer rather than by the card's corners,
 * so the column under the cursor is the one that glows and receives the card. Falls back
 * to the overlapping area when the pointer is between columns or with the keyboard.
 */
const pointerFirst: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

function columnStatus(id: UniqueIdentifier): TaskStatus | null {
  const value = String(id);
  if (!value.startsWith(COLUMN_ID_PREFIX)) return null;
  const status = value.slice(COLUMN_ID_PREFIX.length);
  return (TASK_STATUSES as readonly string[]).includes(status) ? (status as TaskStatus) : null;
}

export function BoardView({
  categories,
  years,
  titlePresets,
}: {
  categories: BoardCategory[];
  years: number[];
  titlePresets: string[];
}) {
  const tasks = useBoardStore((s) => s.tasks);
  const snapshot = useBoardStore((s) => s.snapshot);
  const year = useBoardStore((s) => s.year);
  const moveTask = useBoardStore((s) => s.moveTask);

  const [activeId, setActiveId] = useState<string | null>(null);
  // Column a dragged card would drop into right now (glows).
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const [dialog, setDialog] = useState<TaskDialogMode | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER);
  // Cards shown per column; grows by COLUMN_PAGE_SIZE per "แสดงเพิ่ม". Not remembered.
  const [limits, setLimits] = useState<Partial<Record<TaskStatus, number>>>({});
  const limitOf = (status: TaskStatus) => limits[status] ?? COLUMN_PAGE_SIZE;
  // Bangkok date for FR-13 highlights, fixed for the life of the page.
  const [today] = useState(() => bangkokDate(new Date()));
  const [compact, setCompact] = useCardDensity();

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

  // FR-14 filters show every match. Otherwise each column is paged: the first cards by
  // position ("เสร็จแล้ว": most recently finished) plus unsaved ones. Drag positions are
  // still computed on the full columns.
  const filtering = isFilterActive(filter);
  const shownColumns = useMemo<Columns>(() => {
    const touched = (t: BoardTask) => t.isNew || isTaskChanged(t, snapshot[t.id]);
    return Object.fromEntries(
      TASK_STATUSES.map((s) => {
        const matching = columns[s].filter((t) => matchesFilter(t, filter, today));
        if (filtering) return [s, matching];
        return [s, pageColumn(matching, limits[s] ?? COLUMN_PAGE_SIZE, s === "done" ? "latestDone" : "position", touched)];
      }),
    ) as Columns;
  }, [columns, filter, filtering, today, limits, snapshot]);
  const total = TASK_STATUSES.reduce((n, s) => n + columns[s].length, 0);
  const shown = TASK_STATUSES.reduce((n, s) => n + shownColumns[s].length, 0);

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

  function onDragOver({ over }: DragOverEvent) {
    setOverStatus(over ? (columnStatus(over.id) ?? tasks[String(over.id)]?.status ?? null) : null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverStatus(null);
    if (!over) return;
    const task = tasks[String(active.id)];
    if (!task) return;

    const overTask = tasks[String(over.id)];
    const toStatus = columnStatus(over.id) ?? overTask?.status;
    if (!toStatus) return;

    const list = columns[toStatus].filter((t) => t.id !== task.id);
    // Dropped on the column itself -> right after the last card the user can see
    // (hidden cards further down stay below it).
    const lastShown = shownColumns[toStatus].filter((t) => t.id !== task.id).at(-1);
    let index = lastShown ? list.findIndex((t) => t.id === lastShown.id) + 1 : 0;
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
        collisionDetection={pointerFirst}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOverStatus(null);
        }}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "กด Space หรือ Enter เพื่อหยิบงาน ใช้ปุ่มลูกศรเพื่อย้าย กด Space หรือ Enter อีกครั้งเพื่อวาง หรือกด Esc เพื่อยกเลิก",
          },
        }}
      >
        <div className="mb-3 flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <BoardFilters filter={filter} onChange={setFilter} categories={categories} shown={shown} total={total} />
          </div>
          <CardDensityToggle compact={compact} onChange={setCompact} />
        </div>

        {/* Phones: one column per screen with snap scrolling; desktop: all five. */}
        <div className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:snap-none md:px-0">
          {BOARD_COLUMNS.map((column) => (
            <BoardColumn
              key={column.status}
              status={column.status}
              label={column.label}
              hint={column.hint}
              tasks={shownColumns[column.status]}
              totalCount={columns[column.status].length}
              today={today}
              dropTarget={activeId !== null && overStatus === column.status}
              snapshot={snapshot}
              categoryNames={categoryNames}
              onAdd={() => setDialog({ kind: "create", status: column.status })}
              onEdit={(id) => setDialog({ kind: "edit", taskId: id })}
              onDelete={setDeletingId}
              onMove={moveToColumn}
              compact={compact}
              paging={
                filtering
                  ? null
                  : {
                      hidden: columns[column.status].length - shownColumns[column.status].length,
                      canCollapse: limitOf(column.status) > COLUMN_PAGE_SIZE,
                      onMore: () =>
                        setLimits((l) => ({ ...l, [column.status]: limitOf(column.status) + COLUMN_PAGE_SIZE })),
                      onCollapse: () => setLimits((l) => ({ ...l, [column.status]: COLUMN_PAGE_SIZE })),
                    }
              }
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCardContent
              task={activeTask}
              categoryName={categoryNames.get(activeTask.categoryId) ?? ""}
              unsaved={false}
              due={dueState(activeTask, today)}
              compact={compact}
              className="rotate-2 cursor-grabbing shadow-xl ring-primary/30"
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        mode={dialog}
        onClose={() => setDialog(null)}
        categories={categories}
        years={years}
        titlePresets={titlePresets}
      />
      <DeleteTaskDialog taskId={deletingId} onClose={() => setDeletingId(null)} />
    </>
  );
}
