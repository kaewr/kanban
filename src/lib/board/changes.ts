import type { BoardTask } from "./types";

/** Fields that are persisted; a difference in any of them is an unsaved change. */
const PERSISTED_FIELDS = [
  "title",
  "description",
  "status",
  "categoryId",
  "priority",
  "year",
  "dueDate",
  "progress",
  "position",
  "startedAt",
  "completedAt",
  "reviewerId",
  "isDeleted",
] as const satisfies readonly (keyof BoardTask)[];

export function isTaskChanged(task: BoardTask, original: BoardTask | undefined): boolean {
  if (!original) return true;
  return PERSISTED_FIELDS.some((field) => task[field] !== original[field]);
}

/** FR-09 counter: tasks created, edited, moved or deleted since load / last save. */
export function changedTasks(
  tasks: Record<string, BoardTask>,
  snapshot: Record<string, BoardTask>,
): BoardTask[] {
  return Object.values(tasks).filter((task) => {
    if (task.isNew && task.isDeleted) return false; // created then deleted: nothing to save
    return isTaskChanged(task, snapshot[task.id]);
  });
}
