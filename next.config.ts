import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Version shown in the footer (SemVer from package.json) and the commit it was built from.
const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

function commitSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}

const nextConfig: NextConfig = {
  // Inlined at build time: no file reads at runtime on Vercel.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_COMMIT_SHA: commitSha(),
    APP_CHANGELOG: readFileSync("./CHANGELOG.md", "utf8"),
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      { source: "/", destination: "/board", permanent: false },
      // FR-02 no longer forces a password change (2026-11-20); old links land on the profile page.
      { source: "/change-password", destination: "/profile", permanent: false },
    ];
  },
};

export default nextConfig;
