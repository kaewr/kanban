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
    reviewerId: null,
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
  reviewerId: null,
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

describe("board store after saving", () => {
  it("applySaved makes saved rows the new snapshot", () => {
    const store = setup();
    store.getState().moveTask("a", "in_progress", 1024);
    const sent = changedTasks(store.getState().tasks, store.getState().snapshot);
    const saved = { ...(store.getState().tasks.a as BoardTask), version: 2, moves: [] };
    store.getState().applySaved([saved], sent);
    expect(store.getState().tasks.a).toMatchObject({ version: 2, moves: [] });
    expect(changes(store)).toHaveLength(0);
  });

  it("keeps edits made while the save was in flight", () => {
    const store = setup();
    store.getState().moveTask("a", "in_progress", 1024);
    const sent = changedTasks(store.getState().tasks, store.getState().snapshot);
    const saved = { ...(store.getState().tasks.a as BoardTask), version: 2, moves: [] };
    store.getState().moveTask("a", "review", 1024); // after sending
    store.getState().applySaved([saved], sent);
    const a = store.getState().tasks.a;
    expect(a).toMatchObject({ status: "review", version: 2 });
    expect(a?.moves).toEqual([expect.objectContaining({ from: "in_progress", to: "review" })]);
    expect(changes(store)).toHaveLength(1);
  });

  it("removes soft-deleted rows and swaps a created task for its saved row", () => {
    const store = setup();
    store.getState().deleteTask("a");
    const id = store.getState().createTask("long_term", input);
    const sent = changedTasks(store.getState().tasks, store.getState().snapshot);
    const deletedRow = { ...(store.getState().tasks.a as BoardTask), isDeleted: true, version: 2 };
    const createdRow = { ...(store.getState().tasks[id] as BoardTask), isNew: false, moves: [] };
    store.getState().applySaved([deletedRow, createdRow], sent);
    expect(store.getState().tasks.a).toBeUndefined();
    expect(store.getState().tasks[id]).toMatchObject({ isNew: false });
    expect(changes(store)).toHaveLength(0);
  });

  it("reloadTasks takes the database version of conflicting tasks only", () => {
    const store = setup();
    store.getState().updateTask("a", { ...input, title: "แก้ของฉัน" });
    store.getState().updateTask("b", { ...input, title: "แก้อีกงาน" });
    const fresh = { ...(store.getState().snapshot.a as BoardTask), title: "จากที่อื่น", version: 5 };
    store.getState().reloadTasks(["a"], [fresh]);
    expect(store.getState().tasks.a).toMatchObject({ title: "จากที่อื่น", version: 5 });
    expect(store.getState().tasks.b?.title).toBe("แก้อีกงาน");
    expect(changes(store)).toHaveLength(1);
  });

  it("reloadTasks drops tasks deleted elsewhere; restoreDraft puts draft tasks back", () => {
    const store = setup();
    store.getState().reloadTasks(["b"], []);
    expect(store.getState().tasks.b).toBeUndefined();
    const draftTask = { ...(store.getState().tasks.a as BoardTask), title: "จากร่าง" };
    store.getState().restoreDraft([draftTask]);
    expect(store.getState().tasks.a?.title).toBe("จากร่าง");
    expect(changes(store)).toHaveLength(1);
  });
});

describe("review tags (BR-53)", () => {
  function reviewSetup() {
    return createBoardStore({
      ownerId: "owner",
      year: 2569,
      tasks: [task({ id: "r", status: "in_progress", position: 1, startedAt: "2026-11-01T00:00:00.000Z" })],
    });
  }

  it("names a reviewer only while the task is in review, and clears it when it leaves", () => {
    const store = reviewSetup();
    store.getState().setReviewer("r", "reviewer"); // not in review yet: ignored
    expect(store.getState().tasks.r?.reviewerId).toBeNull();

    store.getState().moveTask("r", "review", 2);
    store.getState().setReviewer("r", "reviewer");
    expect(store.getState().tasks.r?.reviewerId).toBe("reviewer");
    expect(changes(store)).toHaveLength(1);

    store.getState().moveTask("r", "in_progress", 3);
    expect(store.getState().tasks.r?.reviewerId).toBeNull();
  });

  it("keeps the reviewer when reordering inside the review column", () => {
    const store = reviewSetup();
    store.getState().moveTask("r", "review", 2);
    store.getState().setReviewer("r", "reviewer");
    store.getState().moveTask("r", "review", 5);
    expect(store.getState().tasks.r?.reviewerId).toBe("reviewer");
  });

  it("the dialog sets the reviewer only for tasks in review", () => {
    const store = reviewSetup();
    store.getState().updateTask("r", { ...input, reviewerId: "reviewer" });
    expect(store.getState().tasks.r?.reviewerId).toBeNull();
    const id = store.getState().createTask("review", { ...input, reviewerId: "reviewer" });
    expect(store.getState().tasks[id]?.reviewerId).toBe("reviewer");
  });
});
