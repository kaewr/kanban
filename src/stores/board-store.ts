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
  deleteTask: (id: string) => void;
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
              moves: [...task.moves, { from: task.status, to, movedAt }],
            },
          },
        };
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
  }));
}

export type BoardStoreApi = ReturnType<typeof createBoardStore>;
