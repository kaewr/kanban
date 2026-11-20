import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
