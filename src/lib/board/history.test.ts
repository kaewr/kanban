import { describe, expect, it } from "vitest";
import { arrivedAt, movesOf } from "./history";
import type { TaskMove } from "./types";

const created: TaskMove = { from: null, to: "short_term", movedAt: "2026-11-23T02:00:00.000Z" };
const started: TaskMove = { from: "short_term", to: "in_progress", movedAt: "2026-11-23T03:00:00.000Z" };
const review: TaskMove = { from: "in_progress", to: "review", movedAt: "2026-11-23T04:00:00.000Z" };

describe("column history (BR-58)", () => {
  it("joins saved history with unsaved moves", () => {
    expect(movesOf({ moves: [review] }, [created, started])).toEqual([created, started, review]);
  });

  it("knows when the task arrived in its current column", () => {
    expect(arrivedAt({ status: "in_progress", moves: [] }, [created, started])).toBe(started.movedAt);
    expect(arrivedAt({ status: "review", moves: [review] }, [created, started])).toBe(review.movedAt);
  });

  it("is null while the task is still in the column it was created in", () => {
    expect(arrivedAt({ status: "short_term", moves: [] }, [created])).toBeNull();
    expect(arrivedAt({ status: "short_term", moves: [created] }, undefined)).toBeNull();
    expect(arrivedAt({ status: "done", moves: [] }, undefined)).toBeNull();
  });
});
