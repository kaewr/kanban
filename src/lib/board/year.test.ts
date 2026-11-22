import { describe, expect, it } from "vitest";
import { currentBoardYear, fiscalRangeLabel, parseYearParam, yearOptions } from "./year";

// Instants are given in UTC; the board uses Asia/Bangkok (UTC+7).
const at = (iso: string) => new Date(iso);

describe("currentBoardYear (BR-09, BR-10)", () => {
  const calendar = { yearType: "calendar", fiscalStartMonth: 10 } as const;
  const fiscalOct = { yearType: "fiscal", fiscalStartMonth: 10 } as const;

  it("calendar year in the Buddhist Era", () => {
    expect(currentBoardYear(calendar, at("2026-11-21T05:00:00Z"))).toBe(2569);
    expect(currentBoardYear(calendar, at("2026-01-01T00:00:00Z"))).toBe(2569);
  });

  it("uses Bangkok time at the new-year boundary", () => {
    // 2026-12-31 17:30 UTC = 2027-01-01 00:30 in Bangkok
    expect(currentBoardYear(calendar, at("2026-12-31T17:30:00Z"))).toBe(2570);
    expect(currentBoardYear(calendar, at("2026-12-31T16:30:00Z"))).toBe(2569);
  });

  it("fiscal year is named by the year it ends in", () => {
    expect(currentBoardYear(fiscalOct, at("2026-09-30T10:00:00Z"))).toBe(2569);
    expect(currentBoardYear(fiscalOct, at("2026-10-01T10:00:00Z"))).toBe(2570);
    expect(currentBoardYear(fiscalOct, at("2026-11-21T10:00:00Z"))).toBe(2570);
  });

  it("fiscal year starting in January equals the calendar year", () => {
    expect(currentBoardYear({ yearType: "fiscal", fiscalStartMonth: 1 }, at("2026-06-01T00:00:00Z"))).toBe(2569);
  });
});

describe("yearOptions (FR-12)", () => {
  it("includes current ±1 and task years, newest first, without duplicates", () => {
    expect(yearOptions(2569, [2566, 2569])).toEqual([2570, 2569, 2568, 2566]);
  });
});

describe("parseYearParam", () => {
  it("accepts valid B.E. years and falls back otherwise", () => {
    expect(parseYearParam("2568", 2569)).toBe(2568);
    expect(parseYearParam("2026", 2569)).toBe(2569);
    expect(parseYearParam("abc", 2569)).toBe(2569);
    expect(parseYearParam(undefined, 2569)).toBe(2569);
  });
});

describe("fiscalRangeLabel", () => {
  it("names the months a fiscal year covers", () => {
    expect(fiscalRangeLabel(2570, 10)).toBe("ตุลาคม 2569 – กันยายน 2570");
    expect(fiscalRangeLabel(2570, 1)).toBe("มกราคม – ธันวาคม 2570");
  });
});
