import { describe, expect, it } from "vitest";
import { monthGrid, monthLabel, monthRange, parseMonthParam, shiftMonth, spreadByDay } from "./calendar";

describe("parseMonthParam", () => {
  it("accepts YYYY-MM and falls back otherwise", () => {
    expect(parseMonthParam("2026-11", "2000-01")).toBe("2026-11");
    expect(parseMonthParam("2026-13", "2000-01")).toBe("2000-01");
    expect(parseMonthParam("2569-11", "2000-01")).toBe("2000-01");
    expect(parseMonthParam(["2026-11"], "2000-01")).toBe("2000-01");
    expect(parseMonthParam(undefined, "2000-01")).toBe("2000-01");
  });
});

describe("month helpers", () => {
  it("shifts across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
  });

  it("knows the last day, including leap years", () => {
    expect(monthRange("2027-02")).toEqual({ from: "2027-02-01", to: "2027-02-28" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("labels in Thai with the Buddhist Era", () => {
    expect(monthLabel("2026-11")).toBe("พฤศจิกายน 2569");
  });

  it("builds whole Sunday-first weeks", () => {
    const weeks = monthGrid("2026-11"); // 1 Nov 2026 is a Sunday, 30 Nov a Monday
    expect(weeks).toHaveLength(5);
    expect(weeks[0]![0]).toMatchObject({ date: "2026-11-01", inMonth: true, weekend: true });
    expect(weeks[4]![6]).toMatchObject({ date: "2026-12-05", inMonth: false, weekend: true });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe("spreadByDay", () => {
  it("puts a range on every day it covers, clipped to the window", () => {
    const leave = { startDate: "2026-10-30", endDate: "2026-11-02" };
    const days = spreadByDay([leave], "2026-11-01", "2026-11-30");
    expect([...days.keys()]).toEqual(["2026-11-01", "2026-11-02"]);
    expect(days.get("2026-11-01")).toEqual([leave]);
  });
});
