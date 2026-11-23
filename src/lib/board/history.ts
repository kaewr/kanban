// BR-58 column history shown on cards and in the task dialog.
import type { BoardTask, TaskMove } from "./types";

/** Saved history (oldest first) followed by moves not saved yet. */
export function movesOf(task: Pick<BoardTask, "moves">, saved: readonly TaskMove[] | undefined): TaskMove[] {
  return [...(saved ?? []), ...task.moves];
}

/**
 * When the task arrived in its current column, or null if it has stayed in the
 * column it was created in (the card then shows only the creation time).
 */
export function arrivedAt(task: Pick<BoardTask, "status" | "moves">, saved: readonly TaskMove[] | undefined): string | null {
  const last = movesOf(task, saved).at(-1);
  if (!last || last.from === null || last.to !== task.status) return null;
  return last.movedAt;
}
