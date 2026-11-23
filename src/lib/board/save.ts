// FR-09: board diff -> save_board_changes payload, and the RPC result back.
import type { Tables } from "@/types/database";
import { toBoardTask } from "./mapping";
import type { BoardTask } from "./types";

type MovePayload = { from: string | null; to: string; moved_at: string };

export type SaveItem =
  | { op: "delete"; id: string; version: number; title: string }
  | {
      op: "create" | "update";
      id: string;
      version: number;
      owner_id: string;
      title: string;
      description: string | null;
      status: string;
      category_id: string;
      priority: number;
      year: number;
      due_date: string | null;
      progress: number | null;
      position: number;
      started_at: string | null;
      completed_at: string | null;
      reviewer_id: string | null;
      duration_minutes: number | null;
      moves: MovePayload[];
    };

export type SavePayload = { tasks: SaveItem[] };

export function buildSavePayload(changed: readonly BoardTask[]): SavePayload {
  return {
    tasks: changed.map((task): SaveItem => {
      if (task.isDeleted) {
        return { op: "delete", id: task.id, version: task.version, title: task.title };
      }
      return {
        op: task.isNew ? "create" : "update",
        id: task.id,
        version: task.version,
        owner_id: task.ownerId,
        title: task.title,
        description: task.description,
        status: task.status,
        category_id: task.categoryId,
        priority: task.priority,
        year: task.year,
        due_date: task.dueDate,
        progress: task.progress,
        position: task.position,
        started_at: task.startedAt,
        completed_at: task.completedAt,
        reviewer_id: task.reviewerId,
        duration_minutes: task.durationMinutes,
        moves: task.moves.map((m) => ({ from: m.from, to: m.to, moved_at: m.movedAt })),
      };
    }),
  };
}

export type SaveConflict = { id: string; title: string };

export type SaveResult =
  | { ok: true; tasks: BoardTask[] }
  | { ok: false; conflicts: SaveConflict[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Validates the jsonb returned by save_board_changes. */
export function parseSaveResult(data: unknown): SaveResult {
  if (!isRecord(data)) throw new Error("Unexpected save result");
  if (data.ok === true && Array.isArray(data.tasks)) {
    return { ok: true, tasks: (data.tasks as Tables<"tasks">[]).map(toBoardTask) };
  }
  if (data.ok === false && Array.isArray(data.conflicts)) {
    const conflicts = data.conflicts.filter(isRecord).map((c) => ({
      id: String(c.id),
      title: typeof c.title === "string" ? c.title : "",
    }));
    return { ok: false, conflicts };
  }
  throw new Error("Unexpected save result");
}
