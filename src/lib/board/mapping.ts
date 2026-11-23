import type { Tables } from "@/types/database";
import type { TaskPriority, TaskStatus } from "@/types/domain";
import type { BoardTask } from "./types";

/** Database row -> board task. Used on the server (load) and in the browser (save). */
export function toBoardTask(row: Tables<"tasks">): BoardTask {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus, // check constraint guarantees the 5 values
    categoryId: row.category_id,
    priority: row.priority as TaskPriority, // check constraint 1–3
    year: row.year,
    dueDate: row.due_date,
    progress: row.progress,
    position: Number(row.position),
    carriedFromYear: row.carried_from_year,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    reviewerId: row.reviewer_id,
    durationMinutes: row.duration_minutes,
    version: row.version,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    isNew: false,
    moves: [],
  };
}
