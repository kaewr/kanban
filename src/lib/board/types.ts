import type { TaskPriority, TaskStatus } from "@/types/domain";

/** One column change, recorded client-side for task_history (moved_at). */
export type TaskMove = { from: TaskStatus | null; to: TaskStatus; movedAt: string };

/** Board task in client state (camelCase mirror of the tasks row). */
export type BoardTask = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  categoryId: string;
  priority: TaskPriority;
  year: number;
  dueDate: string | null;
  progress: number | null;
  position: number;
  carriedFromYear: number | null;
  startedAt: string | null;
  completedAt: string | null;
  /** BR-53: who is asked to review; only set while status is "review". */
  reviewerId: string | null;
  /** BR-57: minutes worked, only while status is "done". */
  durationMinutes: number | null;
  version: number;
  isDeleted: boolean;
  createdAt: string;
  /** Created in this session, not in the database yet. */
  isNew: boolean;
  /** Column changes since the last save (for FR-09 / task_history). */
  moves: TaskMove[];
};

export type BoardCategory = { id: string; name: string; isActive: boolean };

/** Fields editable in the task dialog. */
export type TaskInput = {
  title: string;
  description: string;
  categoryId: string;
  priority: TaskPriority;
  year: number;
  dueDate: string | null;
  progress: number | null;
  startedAt: string | null;
  completedAt: string | null;
  reviewerId: string | null;
  durationMinutes: number | null;
};
