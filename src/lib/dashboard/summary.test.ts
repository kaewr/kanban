import { describe, expect, it } from "vitest";
import { monthSeries, parseSummary } from "./summary";

describe("monthSeries", () => {
  it("fiscal 2570 from October runs Oct 2569 .. Sep 2570", () => {
    const series = monthSeries(2570, "fiscal", 10, [{ month: "2026-11", done: 3 }]);
    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ key: "2026-10", label: "ต.ค. 69", done: 0 });
    expect(series[1]).toMatchObject({ key: "2026-11", done: 3 });
    expect(series[11]).toMatchObject({ key: "2027-09", label: "ก.ย. 70" });
  });

  it("calendar 2569 runs Jan .. Dec 2026", () => {
    const series = monthSeries(2569, "calendar", 10, []);
    expect(series[0].key).toBe("2026-01");
    expect(series[11].key).toBe("2026-12");
  });
});

describe("parseSummary", () => {
  it("reads the SQL result and tolerates numeric strings and nulls", () => {
    const s = parseSummary({
      today: "2026-11-22",
      totals: { open: 3, overdue: 1, done: 2, done_this_month: 1, cycle_days_avg: "2.5" },
      by_status: { long_term: 1, short_term: 1, in_progress: 1, review: 0, done: 2 },
      monthly: [{ month: "2026-11", done: 2 }],
      categories: [{ id: "c", name: "งานประจำ", done: 2 }],
      review: { entered: 1, reworks: 1, rework_rate: 1, avg_wait_days: null },
      long_term: { total: 2, done: 1, avg_progress: 40 },
      people: [{ id: "p", display_name: "ก", unit_name: null, is_active: true, long_term: 1, short_term: 0, in_progress: 1, review: 0, done: 2, overdue: 1, cycle_days_avg: null }],
    });
    expect(s.totals.cycleDaysAvg).toBe(2.5);
    expect(s.review.avgWaitDays).toBeNull();
    expect(s.people[0]).toMatchObject({ displayName: "ก", counts: { done: 2 }, overdue: 1 });
  });

  it("rejects anything else", () => {
    expect(() => parseSummary(null)).toThrow();
  });
});
