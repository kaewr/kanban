import { describe, expect, it } from "vitest";
import { validateLeave, workingDays, workingDaysByMonth } from "./rules";

describe("workingDays (BR-41)", () => {
  it("counts Monday to Friday only", () => {
    expect(workingDays("2026-11-23", "2026-11-23")).toBe(1); // Monday
    expect(workingDays("2026-11-21", "2026-11-22")).toBe(0); // Sat–Sun
    expect(workingDays("2026-11-20", "2026-11-24")).toBe(3); // Fri, Mon, Tue
    expect(workingDays("2026-11-23", "2026-12-04")).toBe(10);
  });
});

describe("workingDaysByMonth (BR-43)", () => {
  it("splits a range that crosses months", () => {
    // Thu 26 Nov .. Thu 3 Dec 2026 -> Nov: 26, 27, 30 (3) / Dec: 1, 2, 3 (3)
    expect(workingDaysByMonth("2026-11-26", "2026-12-03")).toEqual({ "2026-11": 3, "2026-12": 3 });
  });
});

describe("validateLeave", () => {
  const ok = { leaveType: "sick", startDate: "2026-11-23", endDate: "2026-11-24", note: "" };

  it("accepts a valid single day or range", () => {
    expect(validateLeave(ok)).toEqual({});
    expect(validateLeave({ ...ok, endDate: ok.startDate })).toEqual({});
  });

  it("rejects bad type, reversed dates, weekend-only ranges and long notes", () => {
    expect(validateLeave({ ...ok, leaveType: "holiday" }).leaveType).toBeDefined();
    expect(validateLeave({ ...ok, endDate: "2026-11-20" }).endDate).toMatch(/ไม่ก่อน/);
    expect(validateLeave({ ...ok, startDate: "2026-11-21", endDate: "2026-11-22" }).endDate).toMatch(/วันทำการ/);
    expect(validateLeave({ ...ok, startDate: "" }).startDate).toBeDefined();
    expect(validateLeave({ ...ok, note: "ก".repeat(201) }).note).toBeDefined();
  });
});
