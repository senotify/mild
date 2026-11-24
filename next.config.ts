import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2"],
  poweredByHeader: false,
  async rewrites() {
    // Medium-style /@username URLs map onto the /u/ route tree.
    return [
      { source: "/@:username", destination: "/u/:username" },
      { source: "/@:username/feed.xml", destination: "/u/:username/feed.xml" },
      { source: "/@:username/:slug", destination: "/u/:username/:slug" },
    ];
  },
};

export default config;
