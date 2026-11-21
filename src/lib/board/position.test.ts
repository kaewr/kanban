import { describe, expect, it } from "vitest";
import { positionAtEnd, positionBetween } from "./position";

describe("positionBetween", () => {
  it("handles empty, start, end and middle", () => {
    expect(positionBetween()).toBe(1024);
    expect(positionBetween(undefined, 1024)).toBe(0);
    expect(positionBetween(1024, undefined)).toBe(2048);
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  it("keeps ordering after repeated inserts between the same neighbours", () => {
    let after = 2;
    const before = 1;
    for (let i = 0; i < 30; i++) {
      const p = positionBetween(before, after);
      expect(p).toBeGreaterThan(before);
      expect(p).toBeLessThan(after);
      after = p;
    }
  });
});

describe("positionAtEnd", () => {
  it("appends after the largest position", () => {
    expect(positionAtEnd([])).toBe(1024);
    expect(positionAtEnd([10, 3000, 50])).toBe(4024);
  });
});
