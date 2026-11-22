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

/** "เสร็จแล้ว" shows this many tasks until the user expands it. */
export const DONE_PREVIEW_LIMIT = 10;

/**
 * The latest finished tasks (by completedAt), plus any task the user has touched and
 * not saved yet, kept in the column's own order (position).
 */
export function latestDone<T extends Pick<BoardTask, "id" | "completedAt">>(
  tasks: T[],
  limit: number,
  alwaysShow: (task: T) => boolean,
): T[] {
  if (tasks.length <= limit) return tasks;
  const latest = new Set(
    [...tasks]
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .slice(0, limit)
      .map((t) => t.id),
  );
  return tasks.filter((t) => latest.has(t.id) || alwaysShow(t));
}
