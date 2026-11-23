import { describe, expect, it } from "vitest";
import { buildSavePayload, parseSaveResult } from "./save";
import type { BoardTask } from "./types";

const base: BoardTask = {
  id: "11111111-1111-1111-1111-111111111111",
  ownerId: "owner",
  title: "งาน",
  description: null,
  status: "in_progress",
  categoryId: "cat",
  priority: 2,
  year: 2569,
  dueDate: null,
  progress: null,
  position: 1024,
  carriedFromYear: null,
  startedAt: "2026-11-21T03:00:00.000Z",
  completedAt: null,
  reviewerId: null,
  version: 3,
  isDeleted: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  isNew: false,
  moves: [{ from: "short_term", to: "in_progress", movedAt: "2026-11-21T03:00:00.000Z" }],
};

describe("buildSavePayload", () => {
  it("maps new, edited and deleted tasks to create / update / delete", () => {
    const payload = buildSavePayload([
      { ...base, id: "a", isNew: true, version: 1 },
      { ...base, id: "b" },
      { ...base, id: "c", isDeleted: true },
    ]);
    expect(payload.tasks.map((t) => t.op)).toEqual(["create", "update", "delete"]);
    expect(payload.tasks[1]).toMatchObject({
      id: "b",
      version: 3,
      status: "in_progress",
      category_id: "cat",
      started_at: "2026-11-21T03:00:00.000Z",
      moves: [{ from: "short_term", to: "in_progress", moved_at: "2026-11-21T03:00:00.000Z" }],
    });
    expect(payload.tasks[2]).toEqual({ op: "delete", id: "c", version: 3, title: "งาน" });
  });
});

describe("parseSaveResult", () => {
  it("parses success rows into board tasks", () => {
    const result = parseSaveResult({
      ok: true,
      tasks: [
        {
          id: "a",
          owner_id: "owner",
          title: "งาน",
          description: null,
          status: "done",
          category_id: "cat",
          priority: 1,
          year: 2569,
          due_date: null,
          progress: null,
          position: "2048",
          carried_from_year: null,
          started_at: null,
          completed_at: "2026-11-21T03:00:00+00:00",
          version: 2,
          is_deleted: false,
          created_at: "2026-11-01T00:00:00+00:00",
          updated_at: "2026-11-21T03:00:00+00:00",
        },
      ],
    });
    expect(result).toMatchObject({ ok: true, tasks: [{ id: "a", position: 2048, version: 2, moves: [] }] });
  });

  it("parses conflicts", () => {
    expect(parseSaveResult({ ok: false, conflicts: [{ id: "a", title: "ชน" }] })).toEqual({
      ok: false,
      conflicts: [{ id: "a", title: "ชน" }],
    });
  });

  it("rejects anything else", () => {
    expect(() => parseSaveResult(null)).toThrow();
    expect(() => parseSaveResult({ ok: true })).toThrow();
  });
});
