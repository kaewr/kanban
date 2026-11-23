import { describe, expect, it } from "vitest";
import { dateTimeInputToTimestamp, formatThaiDateTime, toDateTimeInput } from "./dates";

describe("date-time helpers (BR-58)", () => {
  it("shows Bangkok time in the input and on cards", () => {
    expect(toDateTimeInput("2026-11-23T02:05:30.123Z")).toBe("2026-11-23T09:05");
    expect(toDateTimeInput("2026-11-23T17:30:00Z")).toBe("2026-11-24T00:30");
    expect(formatThaiDateTime("2026-11-23T02:05:30.123Z")).toBe("23 พ.ย. 2569 09:05");
  });

  it("turns the input back into an instant, keeping the original when unchanged", () => {
    const original = "2026-11-23T02:05:30.123Z";
    expect(dateTimeInputToTimestamp("2026-11-23T09:05", original)).toBe(original);
    expect(dateTimeInputToTimestamp("2026-11-23T10:15", original)).toBe("2026-11-23T03:15:00.000Z");
    expect(dateTimeInputToTimestamp("2026-11-24T00:30", null)).toBe("2026-11-23T17:30:00.000Z");
  });
});
