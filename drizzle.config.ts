import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs as a standalone CLI, outside Next.js, so environment
// files aren't loaded automatically the way `next dev`/`next build` do it.
// `.env.local` takes precedence, matching Next's own convention; dotenv
// does not override a variable that a prior config() call already set.
config({ path: ".env.local" });
config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and set it " +
      "to your Neon connection string (see docs/architecture.md §4).",
  );
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
