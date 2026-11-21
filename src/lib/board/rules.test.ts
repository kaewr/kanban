import { describe, expect, it } from "vitest";
import { exceedsWipLimit, statusChangeDates, suggestsLongTerm, validateTaskInput } from "./rules";
import type { TaskInput } from "./types";

const NOW = "2026-11-21T03:00:00.000Z";
const EARLIER = "2026-11-01T03:00:00.000Z";

describe("statusChangeDates (BR-03, BR-04)", () => {
  it("sets started_at on the first move into in_progress", () => {
    expect(statusChangeDates({ status: "short_term", startedAt: null, completedAt: null }, "in_progress", NOW)).toEqual({
      startedAt: NOW,
      completedAt: null,
    });
  });

  it("keeps an existing started_at", () => {
    expect(
      statusChangeDates({ status: "review", startedAt: EARLIER, completedAt: null }, "in_progress", NOW).startedAt,
    ).toBe(EARLIER);
  });

  it("sets completed_at when moved into done and clears it when moved out", () => {
    expect(statusChangeDates({ status: "review", startedAt: EARLIER, completedAt: null }, "done", NOW).completedAt).toBe(NOW);
    expect(statusChangeDates({ status: "done", startedAt: EARLIER, completedAt: EARLIER }, "review", NOW)).toEqual({
      startedAt: EARLIER,
      completedAt: null,
    });
  });

  it("does not set started_at for moves into other columns", () => {
    expect(statusChangeDates({ status: "short_term", startedAt: null, completedAt: null }, "review", NOW).startedAt).toBeNull();
  });

  it("changes nothing when the column stays the same", () => {
    expect(statusChangeDates({ status: "done", startedAt: EARLIER, completedAt: EARLIER }, "done", NOW)).toEqual({
      startedAt: EARLIER,
      completedAt: EARLIER,
    });
  });
});

describe("validateTaskInput (BR-01)", () => {
  const base: TaskInput = {
    title: "งาน",
    description: "",
    categoryId: "cat",
    priority: 2,
    year: 2569,
    dueDate: null,
    progress: null,
    startedAt: null,
    completedAt: null,
  };

  it("accepts a minimal short_term task", () => {
    expect(validateTaskInput(base, "short_term", true)).toEqual({});
  });

  it("requires title and category, max 200 chars", () => {
    expect(validateTaskInput({ ...base, title: "  " }, "short_term", true).title).toBeDefined();
    expect(validateTaskInput({ ...base, title: "x".repeat(201) }, "short_term", true).title).toBeDefined();
    expect(validateTaskInput({ ...base, categoryId: "" }, "short_term", true).categoryId).toBeDefined();
  });

  it("requires a start date when created in in_progress / review / done", () => {
    for (const status of ["in_progress", "review", "done"] as const) {
      expect(validateTaskInput(base, status, true).startedAt).toBeDefined();
    }
    expect(validateTaskInput(base, "long_term", true).startedAt).toBeUndefined();
  });

  it("requires a completion date when created in done", () => {
    expect(validateTaskInput({ ...base, startedAt: EARLIER }, "done", true).completedAt).toBeDefined();
    expect(validateTaskInput({ ...base, startedAt: EARLIER, completedAt: NOW }, "done", true)).toEqual({});
  });

  it("rejects completion before start", () => {
    expect(validateTaskInput({ ...base, startedAt: NOW, completedAt: EARLIER }, "done", true).completedAt).toBeDefined();
  });

  it("checks progress range", () => {
    expect(validateTaskInput({ ...base, progress: 101 }, "long_term", true).progress).toBeDefined();
    expect(validateTaskInput({ ...base, progress: 50 }, "long_term", true)).toEqual({});
  });
});

describe("suggestsLongTerm (BR-07)", () => {
  it("flags short_term tasks due more than 30 days after creation", () => {
    expect(suggestsLongTerm({ status: "short_term", createdAt: NOW, dueDate: "2026-12-22" })).toBe(true);
    expect(suggestsLongTerm({ status: "short_term", createdAt: NOW, dueDate: "2026-12-21" })).toBe(false);
    expect(suggestsLongTerm({ status: "long_term", createdAt: NOW, dueDate: "2027-06-01" })).toBe(false);
    expect(suggestsLongTerm({ status: "short_term", createdAt: NOW, dueDate: null })).toBe(false);
  });
});

describe("exceedsWipLimit (BR-08)", () => {
  it("warns above 5", () => {
    expect(exceedsWipLimit(5)).toBe(false);
    expect(exceedsWipLimit(6)).toBe(true);
  });
});
