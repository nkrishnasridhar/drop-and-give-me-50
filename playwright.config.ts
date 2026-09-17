import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ path: ".env.local" });
config({ path: ".env" });

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

/**
 * Not wired into GitHub Actions. CI has a placeholder DATABASE_URL and no
 * Chrome; the architecture's CI list is typecheck, lint, unit tests, build,
 * and migration-drift. This spec needs a real Neon database, a production
 * service worker (`next start`), and Chromium.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 7"],
    // Installed Chrome, not the bundled Chromium download — same browser
    // chrome-launcher uses for Lighthouse, and what a phone-class PWA is
    // actually tested against locally.
    channel: "chrome",
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npx next start --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
