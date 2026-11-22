import { describe, expect, it } from "vitest";
import { isValidUsername } from "@/lib/username";
import { generateUsername } from "@/lib/username";
import { parsePosition, parseUnitId, POSITION_MAX } from "./users";

describe("parsePosition (BR-30)", () => {
  it("trims, collapses spaces and treats blank as no position", () => {
    expect(parsePosition("  นักวิชาการ   ศึกษา ")).toEqual({ ok: true, value: "นักวิชาการ ศึกษา" });
    expect(parsePosition("   ")).toEqual({ ok: true, value: null });
    expect(parsePosition(undefined)).toEqual({ ok: true, value: null });
  });

  it("rejects non-strings and long values", () => {
    expect(parsePosition(5).ok).toBe(false);
    expect(parsePosition("ก".repeat(POSITION_MAX + 1)).ok).toBe(false);
  });
});

describe("parseUnitId (BR-29)", () => {
  it("accepts only a known unit", () => {
    const units = ["academic", "planning"];
    expect(parseUnitId("academic", units)).toEqual({ ok: true, value: "academic" });
    expect(parseUnitId("finance", units).ok).toBe(false);
    expect(parseUnitId(undefined, units).ok).toBe(false);
  });
});

describe("generateUsername", () => {
  it("creates valid, different usernames (BR-22)", () => {
    const a = generateUsername();
    const b = generateUsername();
    expect(isValidUsername(a)).toBe(true);
    expect(a).not.toBe(b);
  });
});
