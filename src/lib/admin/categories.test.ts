import { describe, expect, it } from "vitest";
import {
  canDeactivate,
  CATEGORY_NAME_MAX,
  DUPLICATE_CATEGORY,
  moveCategory,
  normalizeCategoryName,
  validateCategoryName,
  type CategoryRow,
} from "./categories";

const rows: CategoryRow[] = [
  { id: "a", name: "พัฒนาตนเอง", sortOrder: 1, isActive: true },
  { id: "b", name: "งานประจำ", sortOrder: 2, isActive: true },
  { id: "c", name: "อื่น ๆ", sortOrder: 3, isActive: false },
];

describe("category names", () => {
  it("normalizes whitespace", () => {
    expect(normalizeCategoryName("  งาน   ประจำ ")).toBe("งาน ประจำ");
    expect(normalizeCategoryName(null)).toBe("");
  });

  it("rejects blank, too long and duplicate names (case-insensitive)", () => {
    expect(validateCategoryName("", rows)).toMatch(/กรุณากรอก/);
    expect(validateCategoryName("x".repeat(CATEGORY_NAME_MAX + 1), rows)).toMatch(/ไม่เกิน/);
    expect(validateCategoryName("งานประจำ", rows)).toBe(DUPLICATE_CATEGORY);
    expect(validateCategoryName("Meeting", [{ name: "meeting" }])).toBe(DUPLICATE_CATEGORY);
    expect(validateCategoryName("งานโครงการ", rows)).toBeNull();
  });
});

describe("canDeactivate", () => {
  it("keeps at least one active category", () => {
    expect(canDeactivate(rows, "a")).toBe(true);
    expect(canDeactivate(rows.filter((r) => r.id !== "b"), "a")).toBe(false);
  });
});

describe("moveCategory", () => {
  it("swaps with the neighbour and stops at the ends", () => {
    expect(moveCategory(rows, "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveCategory(rows, "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveCategory(rows, "a", -1)).toBeNull();
    expect(moveCategory(rows, "c", 1)).toBeNull();
    expect(moveCategory(rows, "zzz", 1)).toBeNull();
  });
});
