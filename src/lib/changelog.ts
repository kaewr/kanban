// Release notes (CHANGELOG.md, Keep a Changelog) and the running version.

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "local";

export type ReleaseSection = { title: string; items: string[] };
export type Release = { version: string; date: string | null; sections: ReleaseSection[] };

const RELEASE = /^##\s+\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/;

/** Parses "## [x.y.z] - date", "### section" and "- item" lines; newest first as written. */
export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const release = RELEASE.exec(line);
    if (release) {
      releases.push({ version: release[1]!, date: release[2] ?? null, sections: [] });
      continue;
    }
    const current = releases.at(-1);
    if (!current) continue;
    if (line.startsWith("### ")) {
      current.sections.push({ title: line.slice(4).trim(), items: [] });
    } else if (line.startsWith("- ")) {
      let section = current.sections.at(-1);
      if (!section) {
        section = { title: "", items: [] };
        current.sections.push(section);
      }
      section.items.push(line.slice(2).trim());
    }
  }
  return releases;
}
