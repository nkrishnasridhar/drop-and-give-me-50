import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pins the workspace root explicitly so Turbopack doesn't have to infer
  // it by walking up for a lockfile — this project's parent directories
  // (under Downloads) may contain unrelated lockfiles.
  turbopack: {
    root: import.meta.dirname ?? path.resolve("."),
  },
};

export default nextConfig;
