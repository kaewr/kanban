import { describe, expect, it } from "vitest";
import { DUPLICATE_PRESET, normalizePresetName, validatePresetName } from "./task-titles";

describe("task title presets", () => {
  it("normalizes spaces", () => {
    expect(normalizePresetName("  จัดทำ   รายงาน ")).toBe("จัดทำ รายงาน");
    expect(normalizePresetName(undefined)).toBe("");
  });

  it("rejects empty, too long and duplicate names", () => {
    expect(validatePresetName("", [])).toBe("กรุณากรอกหัวข้องาน");
    expect(validatePresetName("ก".repeat(101), [])).toContain("ไม่เกิน 100");
    expect(validatePresetName("Report", [{ name: "report" }])).toBe(DUPLICATE_PRESET);
    expect(validatePresetName("จัดทำรายงาน", [{ name: "บันทึกข้อความ" }])).toBeNull();
  });
});
