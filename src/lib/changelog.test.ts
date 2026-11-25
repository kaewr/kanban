import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseChangelog } from "./changelog";

describe("parseChangelog", () => {
  it("reads releases, sections and items", () => {
    const releases = parseChangelog(
      "# มีอะไรใหม่\n\nintro\n\n## [1.2.1] - 2026-11-24\n\n### แก้ไข\n- ข้อหนึ่ง\n- ข้อสอง\n\n## [1.2.0] - 2026-11-23\n\n### เพิ่ม\n- ใหม่\n",
    );
    expect(releases).toEqual([
      { version: "1.2.1", date: "2026-11-24", sections: [{ title: "แก้ไข", items: ["ข้อหนึ่ง", "ข้อสอง"] }] },
      { version: "1.2.0", date: "2026-11-23", sections: [{ title: "เพิ่ม", items: ["ใหม่"] }] },
    ]);
  });

  it("the newest entry in CHANGELOG.md matches package.json (release routine)", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    const [latest] = parseChangelog(readFileSync("CHANGELOG.md", "utf8"));
    expect(latest?.version).toBe(pkg.version);
    expect(latest?.sections.length).toBeGreaterThan(0);
  });
});
