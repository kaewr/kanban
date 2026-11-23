// Board state (FR-07, FR-08). Changes live here only until "บันทึก" (FR-09, M6).
// A store instance is created per board mount (via BoardStoreProvider), never at
// module level, so server renders never share state between users.
import { createStore } from "zustand/vanilla";
import { positionAtEnd } from "@/lib/board/position";
import { statusChangeDates } from "@/lib/board/rules";
import type { BoardTask, TaskInput } from "@/lib/board/types";
import type { TaskStatus } from "@/types/domain";

export type BoardState = {
  ownerId: string;
  year: number;
  tasks: Record<string, BoardTask>;
  /** Tasks as loaded from the database; diffed against `tasks` for FR-09. */
  snapshot: Record<string, BoardTask>;
};

export type BoardActions = {
  createTask: (status: TaskStatus, input: TaskInput) => string;
  updateTask: (id: string, input: TaskInput) => void;
  moveTask: (id: string, to: TaskStatus, position: number) => void;
  /** BR-53: name (or clear) the reviewer of a task in "review". */
  setReviewer: (id: string, reviewerId: string | null) => void;
  deleteTask: (id: string) => void;
  /**
   * After a successful save: saved rows become the new snapshot (FR-09).
   * `sent` is the task objects that were sent; a task edited again while the save
   * was in flight keeps those newer local edits on top of the saved row.
   */
  applySaved: (rows: BoardTask[], sent: BoardTask[]) => void;
  /**
   * After a conflict: take the database version of these tasks (dropping local edits
   * to them only); ids missing from `rows` were deleted elsewhere.
   */
  reloadTasks: (ids: string[], rows: BoardTask[]) => void;
  /** FR-10: put draft tasks back on top of the loaded board. */
  restoreDraft: (draft: BoardTask[]) => void;
  /** BR-47: the year's tasks were cleared in the database; empty the board, drop unsaved work. */
  clearAll: () => void;
};

export type BoardStore = BoardState & BoardActions;

export type BoardInit = { ownerId: string; year: number; tasks: BoardTask[] };

function nowIso(): string {
  return new Date().toISOString();
}

function columnPositions(tasks: Record<string, BoardTask>, status: TaskStatus, excludeId?: string): number[] {
  return Object.values(tasks)
    .filter((t) => t.status === status && !t.isDeleted && t.id !== excludeId)
    .map((t) => t.position);
}

export function createBoardStore(init: BoardInit) {
  const byId = Object.fromEntries(init.tasks.map((t) => [t.id, t]));

  return createStore<BoardStore>()((set, get) => ({
    ownerId: init.ownerId,
    year: init.year,
    tasks: byId,
    snapshot: byId,

    createTask: (status, input) => {
      const id = crypto.randomUUID();
      const now = nowIso();
      const task: BoardTask = {
        id,
        ownerId: get().ownerId,
        title: input.title.trim(),
        description: input.description.trim() || null,
        status,
        categoryId: input.categoryId,
        priority: input.priority,
        year: input.year,
        dueDate: input.dueDate,
        progress: input.progress,
        position: positionAtEnd(columnPositions(get().tasks, status)),
        carriedFromYear: null,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        reviewerId: status === "review" ? input.reviewerId : null,
        durationMinutes: status === "done" ? input.durationMinutes : null,
        version: 1,
        isDeleted: false,
        createdAt: now,
        isNew: true,
        moves: [{ from: null, to: status, movedAt: now }],
      };
      set((s) => ({ tasks: { ...s.tasks, [id]: task } }));
      return id;
    },

    updateTask: (id, input) => {
      set((s) => {
        const task = s.tasks[id];
        if (!task) return s;
        return {
          tasks: {
            ...s.tasks,
            [id]: {
              ...task,
              title: input.title.trim(),
              description: input.description.trim() || null,
              categoryId: input.categoryId,
              priority: input.priority,
              year: input.year,
              dueDate: input.dueDate,
              progress: input.progress,
              startedAt: input.startedAt,
              completedAt: input.completedAt,
              reviewerId: task.status === "review" ? input.reviewerId : null,
              durationMinutes: task.status === "done" ? input.durationMinutes : null,
            },
          },
        };
      });
    },

    moveTask: (id, to, position) => {
      set((s) => {
        const task = s.tasks[id];
        if (!task) return s;
        if (task.status === to) {
          return { tasks: { ...s.tasks, [id]: { ...task, position } } };
        }
        const movedAt = nowIso(); // real time of the move (task_history.changed_at)
        return {
          tasks: {
            ...s.tasks,
            [id]: {
              ...task,
              ...statusChangeDates(task, to, movedAt),
              status: to,
              position,
              reviewerId: to === "review" ? task.reviewerId : null, // BR-53
              durationMinutes: null, // BR-57: cleared on any column change, like completed_at
              moves: [...task.moves, { from: task.status, to, movedAt }],
            },
          },
        };
      });
    },

    setReviewer: (id, reviewerId) => {
      set((s) => {
        const task = s.tasks[id];
        if (!task || task.status !== "review") return s;
        return { tasks: { ...s.tasks, [id]: { ...task, reviewerId } } };
      });
    },

    deleteTask: (id) => {
      set((s) => {
        const task = s.tasks[id];
        if (!task) return s;
        if (task.isNew) {
          // Never saved: just drop it.
          const rest = { ...s.tasks };
          delete rest[id];
          return { tasks: rest };
        }
        return { tasks: { ...s.tasks, [id]: { ...task, isDeleted: true } } }; // BR-12
      });
    },

    applySaved: (rows, sent) => {
      set((s) => {
        const tasks = { ...s.tasks };
        const snapshot = { ...s.snapshot };
        const sentById = new Map(sent.map((t) => [t.id, t]));
        for (const row of rows) {
          const local = tasks[row.id];
          const sentTask = sentById.get(row.id);
          const editedSince = local !== undefined && sentTask !== undefined && local !== sentTask;

          if (row.isDeleted) {
            delete snapshot[row.id];
            if (!editedSince) delete tasks[row.id];
            continue;
          }
          snapshot[row.id] = row;
          tasks[row.id] =
            editedSince && local
              ? {
                  ...local,
                  version: row.version,
                  isNew: false,
                  createdAt: row.createdAt,
                  moves: local.moves.slice(sentTask?.moves.length ?? 0),
                }
              : row;
        }
        return { tasks, snapshot };
      });
    },

    reloadTasks: (ids, rows) => {
      set((s) => {
        const tasks = { ...s.tasks };
        const snapshot = { ...s.snapshot };
        const fresh = new Map(rows.map((r) => [r.id, r]));
        for (const id of ids) {
          const row = fresh.get(id);
          if (row && !row.isDeleted) {
            tasks[id] = row;
            snapshot[id] = row;
          } else {
            delete tasks[id];
            delete snapshot[id];
          }
        }
        return { tasks, snapshot };
      });
    },

    restoreDraft: (draft) => {
      set((s) => {
        const tasks = { ...s.tasks };
        for (const task of draft) tasks[task.id] = task;
        return { tasks };
      });
    },

    clearAll: () => set({ tasks: {}, snapshot: {} }),
  }));
}

export type BoardStoreApi = ReturnType<typeof createBoardStore>;
