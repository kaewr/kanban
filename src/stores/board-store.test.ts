import { describe, expect, it } from "vitest";
import { changedTasks } from "@/lib/board/changes";
import type { BoardTask, TaskInput } from "@/lib/board/types";
import { createBoardStore } from "./board-store";

function task(partial: Partial<BoardTask> & Pick<BoardTask, "id" | "status" | "position">): BoardTask {
  return {
    ownerId: "owner",
    title: partial.id,
    description: null,
    categoryId: "cat",
    priority: 2,
    year: 2569,
    dueDate: null,
    progress: null,
    carriedFromYear: null,
    startedAt: null,
    completedAt: null,
    version: 1,
    isDeleted: false,
    createdAt: "2026-11-01T00:00:00.000Z",
    isNew: false,
    moves: [],
    ...partial,
  };
}

const input: TaskInput = {
  title: "ใหม่",
  description: "",
  categoryId: "cat",
  priority: 1,
  year: 2569,
  dueDate: null,
  progress: null,
  startedAt: null,
  completedAt: null,
};

function setup() {
  return createBoardStore({
    ownerId: "owner",
    year: 2569,
    tasks: [task({ id: "a", status: "short_term", position: 1024 }), task({ id: "b", status: "done", position: 1024, startedAt: "2026-11-02T00:00:00.000Z", completedAt: "2026-11-03T00:00:00.000Z" })],
  });
}

const changes = (store: ReturnType<typeof setup>) => changedTasks(store.getState().tasks, store.getState().snapshot);

describe("board store", () => {
  it("starts with no changes", () => {
    expect(changes(setup())).toHaveLength(0);
  });

  it("creates a task at the end of the column and counts it", () => {
    const store = setup();
    const id = store.getState().createTask("short_term", input);
    const created = store.getState().tasks[id];
    expect(created).toMatchObject({ status: "short_term", position: 2048, isNew: true, title: "ใหม่" });
    expect(created?.moves).toEqual([{ from: null, to: "short_term", movedAt: expect.any(String) }]);
    expect(changes(store)).toHaveLength(1);
  });

  it("moving applies BR-03/BR-04 and records moved_at", () => {
    const store = setup();
    store.getState().moveTask("a", "in_progress", 1024);
    const moved = store.getState().tasks.a;
    expect(moved?.status).toBe("in_progress");
    expect(moved?.startedAt).not.toBeNull();
    expect(moved?.moves).toHaveLength(1);
    expect(moved?.moves[0]).toMatchObject({ from: "short_term", to: "in_progress" });

    store.getState().moveTask("b", "review", 1024);
    expect(store.getState().tasks.b?.completedAt).toBeNull();
    expect(changes(store)).toHaveLength(2);
  });

  it("reordering in the same column only changes position", () => {
    const store = setup();
    store.getState().moveTask("a", "short_term", 512);
    expect(store.getState().tasks.a).toMatchObject({ position: 512, moves: [] });
  });

  it("soft-deletes saved tasks and drops unsaved ones", () => {
    const store = setup();
    store.getState().deleteTask("a");
    expect(store.getState().tasks.a?.isDeleted).toBe(true);

    const id = store.getState().createTask("long_term", input);
    store.getState().deleteTask(id);
    expect(store.getState().tasks[id]).toBeUndefined();
    expect(changes(store)).toHaveLength(1);
  });

  it("editing back to the original values is not a change", () => {
    const store = setup();
    const original = store.getState().tasks.a as BoardTask;
    store.getState().updateTask("a", { ...input, title: "แก้" });
    expect(changes(store)).toHaveLength(1);
    store.getState().updateTask("a", {
      ...input,
      title: original.title,
      priority: original.priority,
    });
    expect(changes(store)).toHaveLength(0);
  });
});
