import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Neon's HTTP driver is used instead of a pooled TCP client because the
 * backend runs as Vercel Node route handlers (see docs/architecture.md §4):
 * short-lived serverless functions repeatedly opening TCP connections
 * exhaust Postgres connection limits, whereas the HTTP driver issues a
 * single fetch per query with no connection to manage.
 */
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
