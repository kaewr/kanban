import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, isFilterActive, matchesFilter } from "./filter";
import { dueLabel, dueState } from "./rules";

const today = "2026-11-22";
const task = {
  title: "ปรับปรุงหน้าเว็บคณะ",
  description: "แก้ไขเมนูภาษาอังกฤษ",
  categoryId: "cat-a",
  priority: 1 as const,
  status: "in_progress" as const,
  dueDate: "2026-11-20",
};

describe("dueState (FR-13)", () => {
  it("is overdue before today, soon from today to +3 days, nothing after or when done", () => {
    expect(dueState({ status: "in_progress", dueDate: "2026-11-20" }, today)).toEqual({ kind: "overdue", days: 2 });
    expect(dueState({ status: "short_term", dueDate: "2026-11-22" }, today)).toEqual({ kind: "soon", days: 0 });
    expect(dueState({ status: "short_term", dueDate: "2026-11-25" }, today)).toEqual({ kind: "soon", days: 3 });
    expect(dueState({ status: "short_term", dueDate: "2026-11-26" }, today)).toBeNull();
    expect(dueState({ status: "done", dueDate: "2026-11-01" }, today)).toBeNull();
    expect(dueState({ status: "review", dueDate: null }, today)).toBeNull();
  });

  it("labels", () => {
    expect(dueLabel({ kind: "overdue", days: 2 })).toBe("เกินกำหนด 2 วัน");
    expect(dueLabel({ kind: "soon", days: 0 })).toBe("ครบกำหนดวันนี้");
    expect(dueLabel({ kind: "soon", days: 1 })).toBe("ครบกำหนดพรุ่งนี้");
    expect(dueLabel({ kind: "soon", days: 3 })).toBe("อีก 3 วันครบกำหนด");
  });
});

describe("matchesFilter (FR-14)", () => {
  it("empty filter matches everything", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(matchesFilter(task, EMPTY_FILTER, today)).toBe(true);
  });

  it("searches title and description, case-insensitive", () => {
    expect(matchesFilter(task, { ...EMPTY_FILTER, query: "เว็บ" }, today)).toBe(true);
    expect(matchesFilter(task, { ...EMPTY_FILTER, query: "อังกฤษ" }, today)).toBe(true);
    expect(matchesFilter({ ...task, title: "Website" }, { ...EMPTY_FILTER, query: "WEB" }, today)).toBe(true);
    expect(matchesFilter(task, { ...EMPTY_FILTER, query: "ประชุม" }, today)).toBe(false);
  });

  it("filters by category, priority and due state together", () => {
    expect(matchesFilter(task, { ...EMPTY_FILTER, categoryId: "cat-b" }, today)).toBe(false);
    expect(matchesFilter(task, { ...EMPTY_FILTER, priority: 2 }, today)).toBe(false);
    expect(matchesFilter(task, { ...EMPTY_FILTER, due: "overdue" }, today)).toBe(true);
    expect(matchesFilter(task, { ...EMPTY_FILTER, due: "soon" }, today)).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, due: "soon" })).toBe(true);
  });
});
