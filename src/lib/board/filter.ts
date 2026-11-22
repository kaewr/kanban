import { dueState } from "./rules";
import type { BoardTask } from "./types";
import type { TaskPriority } from "@/types/domain";

/** FR-14: board search and filters (client-side only, not saved). */
export type BoardFilter = {
  query: string;
  categoryId: string; // "" = all
  priority: TaskPriority | 0; // 0 = all
  due: "all" | "overdue" | "soon";
};

export const EMPTY_FILTER: BoardFilter = { query: "", categoryId: "", priority: 0, due: "all" };

export function isFilterActive(filter: BoardFilter): boolean {
  return (
    filter.query.trim() !== "" || filter.categoryId !== "" || filter.priority !== 0 || filter.due !== "all"
  );
}

export function matchesFilter(
  task: Pick<BoardTask, "title" | "description" | "categoryId" | "priority" | "status" | "dueDate">,
  filter: BoardFilter,
  today: string,
): boolean {
  const query = filter.query.trim().toLocaleLowerCase("th");
  if (query) {
    const text = `${task.title}\n${task.description ?? ""}`.toLocaleLowerCase("th");
    if (!text.includes(query)) return false;
  }
  if (filter.categoryId && task.categoryId !== filter.categoryId) return false;
  if (filter.priority && task.priority !== filter.priority) return false;
  if (filter.due !== "all" && dueState(task, today)?.kind !== filter.due) return false;
  return true;
}

/** Each column shows this many cards at first, then this many more per click. */
export const COLUMN_PAGE_SIZE = 10;

/**
 * The cards a column shows: the first `limit` (by position, or for "เสร็จแล้ว" the most
 * recently finished), plus any card the user has touched and not saved yet, so a moved
 * card never disappears into the hidden part. Column order is kept.
 */
export function pageColumn<T extends Pick<BoardTask, "id" | "completedAt">>(
  tasks: T[],
  limit: number,
  pick: "position" | "latestDone",
  alwaysShow: (task: T) => boolean,
): T[] {
  if (tasks.length <= limit) return tasks;
  const ordered =
    pick === "latestDone"
      ? [...tasks].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      : tasks;
  const chosen = new Set(ordered.slice(0, limit).map((t) => t.id));
  return tasks.filter((t) => chosen.has(t.id) || alwaysShow(t));
}
