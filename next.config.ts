import path from "node:path";
import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pins the workspace root explicitly so Turbopack doesn't have to infer
  // it by walking up for a lockfile — this project's parent directories
  // (under Downloads) may contain unrelated lockfiles.
  turbopack: {
    root: import.meta.dirname ?? path.resolve("."),
  },
  // web-push speaks the VAPID protocol over Node https; keep it out of
  // the bundle so those Node APIs stay intact (docs/architecture.md §1).
  serverExternalPackages: ["web-push"],
};

export default withSerwist(nextConfig);
