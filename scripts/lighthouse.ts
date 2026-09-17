/**
 * Production Lighthouse check for the PWA shell.
 *
 * Lighthouse 12+ removed the PWA category (Chrome's installability criteria
 * moved out of Lighthouse). This script still runs Lighthouse for
 * accessibility / best-practices / SEO / performance, then asserts the
 * installability surface Chrome actually uses: a valid manifest, icons,
 * and a registered service worker.
 *
 * Not wired into GitHub Actions. Run:
 *
 *   npm run build
 *   npm run lighthouse
 *
 * If port 4173 is free, this script starts `next start` itself.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const PORT = Number(process.env.LIGHTHOUSE_PORT ?? 4173);
const ORIGIN = process.env.LIGHTHOUSE_URL ?? `http://127.0.0.1:${PORT}`;
const REPORT_DIR = path.resolve("lighthouse-report");

const CATEGORY_MIN = {
  accessibility: 0.9,
  "best-practices": 0.9,
  seo: 0.9,
  performance: 0.7,
} as const;

const REQUIRED_AUDITS = [
  "document-title",
  "html-has-lang",
  "meta-description",
  "button-name",
] as const;

const DISPLAY_MODES = new Set(["standalone", "fullscreen", "minimal-ui"]);

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      void isPortOpen(port).then((open) => {
        if (open) {
          resolve();
          return;
        }
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for 127.0.0.1:${port}`));
          return;
        }
        setTimeout(tick, 400);
      });
    };
    tick();
  });
}

async function ensureServer(): Promise<ChildProcess | null> {
  if (await isPortOpen(PORT)) return null;

  const child = spawn(
    "npx",
    ["next", "start", "--hostname", "127.0.0.1", "--port", String(PORT)],
    { stdio: "inherit", shell: true },
  );
  await waitForPort(PORT, 60_000);
  return child;
}

function auditPassed(
  audits: Record<string, { score: number | null } | undefined>,
  id: string,
): boolean {
  const audit = audits[id];
  if (!audit) return false;
  return audit.score === 1;
}

async function assertPwaSurface(origin: string): Promise<string[]> {
  const failures: string[] = [];
  const manifestResponse = await fetch(new URL("/manifest.webmanifest", origin));
  if (!manifestResponse.ok) {
    return [`manifest.webmanifest HTTP ${manifestResponse.status}`];
  }

  const manifest = (await manifestResponse.json()) as {
    name?: string;
    short_name?: string;
    start_url?: string;
    display?: string;
    icons?: { src?: string; sizes?: string; purpose?: string }[];
  };

  if (!manifest.name && !manifest.short_name) {
    failures.push("manifest is missing name/short_name");
  }
  if (!manifest.start_url) failures.push("manifest is missing start_url");
  if (!manifest.display || !DISPLAY_MODES.has(manifest.display)) {
    failures.push("manifest display must be standalone, fullscreen, or minimal-ui");
  }

  const icons = manifest.icons ?? [];
  const sizes = new Set(
    icons.flatMap((icon) => (icon.sizes ?? "").split(" ").filter(Boolean)),
  );
  if (!sizes.has("192x192")) failures.push("manifest is missing a 192x192 icon");
  if (!sizes.has("512x512")) failures.push("manifest is missing a 512x512 icon");
  if (!icons.some((icon) => (icon.purpose ?? "any").includes("maskable"))) {
    failures.push("manifest is missing a maskable icon");
  }

  for (const icon of icons) {
    if (!icon.src) continue;
    const iconUrl = new URL(icon.src, origin);
    const iconResponse = await fetch(iconUrl);
    if (!iconResponse.ok) {
      failures.push(`${icon.src} HTTP ${iconResponse.status}`);
    }
  }

  const swResponse = await fetch(new URL("/serwist/sw.js", origin));
  if (!swResponse.ok) {
    failures.push(`service worker /serwist/sw.js HTTP ${swResponse.status}`);
  } else {
    const body = await swResponse.text();
    if (!body.includes("precache") && !body.includes("Serwist")) {
      failures.push("service worker script does not look like the Serwist build");
    }
  }

  return failures;
}

async function main(): Promise<void> {
  const started = await ensureServer();
  const chrome = await launch({
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
  });

  try {
    const result = await lighthouse(ORIGIN, {
      port: chrome.port,
      output: ["json", "html"],
      logLevel: "error",
      onlyCategories: [
        "performance",
        "accessibility",
        "best-practices",
        "seo",
      ],
    });

    if (!result?.lhr) {
      throw new Error("Lighthouse returned no result.");
    }

    await mkdir(REPORT_DIR, { recursive: true });
    if (typeof result.report === "string") {
      await writeFile(path.join(REPORT_DIR, "report.html"), result.report);
    } else if (Array.isArray(result.report)) {
      const html = result.report.find((entry) => entry.includes("<html"));
      const json = result.report.find((entry) => entry.startsWith("{"));
      if (html) await writeFile(path.join(REPORT_DIR, "report.html"), html);
      if (json) await writeFile(path.join(REPORT_DIR, "report.json"), json);
    }

    const failures: string[] = [];
    const categories = result.lhr.categories;

    for (const [id, min] of Object.entries(CATEGORY_MIN)) {
      const category = categories[id];
      if (!category || category.score === null) {
        failures.push(`missing category ${id}`);
        continue;
      }
      if (category.score < min) {
        failures.push(
          `${id} ${(category.score * 100).toFixed(0)} < ${(min * 100).toFixed(0)}`,
        );
      }
    }

    for (const id of REQUIRED_AUDITS) {
      if (!auditPassed(result.lhr.audits, id)) {
        const title = result.lhr.audits[id]?.title ?? id;
        failures.push(`audit failed: ${id} (${title})`);
      }
    }

    failures.push(...(await assertPwaSurface(ORIGIN)));

    for (const [id, category] of Object.entries(categories)) {
      const score =
        category.score === null ? "n/a" : String(Math.round(category.score * 100));
      console.log(`${id}: ${score}`);
    }

    if (failures.length > 0) {
      throw new Error(`Lighthouse failed:\n- ${failures.join("\n- ")}`);
    }

    console.log(`Lighthouse passed against ${ORIGIN}`);
  } finally {
    chrome.kill();
    if (started) started.kill();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
