import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/**
 * Renders a fixed list of our own string literals (never user input) as a
 * SQL `'a', 'b', 'c'` fragment for use inside `check()` constraints, which
 * are DDL and can't be parameterized the way a normal query can.
 */
function quotedList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

// ---------------------------------------------------------------------------
// Auth.js tables (Drizzle adapter, database session strategy).
// Shape follows the adapter's documented schema; only `verificationTokens`
// is omitted, since it's only needed for magic-link sign-in and this app
// is Google-only (docs/architecture.md §1).
// ---------------------------------------------------------------------------

export const users = pgTable("user", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    // These six keep Auth.js's own snake_case naming rather than this
    // file's usual camelCase: `AdapterAccount` (the OAuth token shape
    // Auth.js passes to the adapter at runtime) uses these exact
    // property names, and the Drizzle adapter maps them straight
    // through by key. Renaming them to camelCase would silently drop
    // token data, not just fail a type check.
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

// ---------------------------------------------------------------------------
// Domain: push-up variations (seeded reference data, see
// scripts/seed-variations.ts). No progression graph, no video links, no
// icons (docs/decisions.md #10).
// ---------------------------------------------------------------------------

export const VARIATION_FAMILIES = [
  "scapular",
  "assisted",
  "standard",
  "tricep",
  "wide",
  "dynamic",
  "shoulder",
  "unilateral",
  "advanced",
] as const;
export type VariationFamily = (typeof VARIATION_FAMILIES)[number];

export const MUSCLE_EMPHASES = [
  "chest",
  "triceps",
  "shoulders",
  "serratus",
  "core",
] as const;
export type MuscleEmphasis = (typeof MUSCLE_EMPHASES)[number];

export const variations = pgTable(
  "variation",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    family: text("family").$type<VariationFamily>().notNull(),
    // Load relative to a regular push-up (1.00). Shown to the user, never
    // hidden — see docs/architecture.md §3.
    intensityFactor: numeric("intensity_factor", {
      precision: 3,
      scale: 2,
      mode: "number",
    }).notNull(),
    difficulty: smallint("difficulty").notNull(),
    primaryEmphasis: text("primary_emphasis").$type<MuscleEmphasis>().notNull(),
  },
  (table) => [
    check(
      "variation_family_check",
      sql`${table.family} in (${sql.raw(quotedList(VARIATION_FAMILIES))})`,
    ),
    check(
      "variation_primary_emphasis_check",
      sql`${table.primaryEmphasis} in (${sql.raw(quotedList(MUSCLE_EMPHASES))})`,
    ),
    check("variation_difficulty_range", sql`${table.difficulty} between 1 and 5`),
  ],
);

// ---------------------------------------------------------------------------
// Domain: push_sets — the atomic unit. No workout/session/program entity,
// ever (docs/decisions.md #1). `id` is always client-generated (UUIDv7),
// never server-generated (docs/decisions.md #2), which is what makes
// offline retry safe.
// ---------------------------------------------------------------------------

export const SET_SOURCES = ["app", "shortcut", "backfill"] as const;
export type SetSource = (typeof SET_SOURCES)[number];

export const pushSets = pgTable(
  "push_set",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    variationId: text("variation_id")
      .notNull()
      .references(() => variations.id),
    reps: integer("reps").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    // Computed once at write time, never re-derived from UTC at read time
    // (docs/decisions.md #3). See src/domain/date.ts.
    localDate: date("local_date", { mode: "string" }).notNull(),
    tz: text("tz").notNull(),
    note: text("note"),
    source: text("source").$type<SetSource>().notNull().default("app"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check("push_set_reps_range", sql`${table.reps} between 1 and 500`),
    check(
      "push_set_source_check",
      sql`${table.source} in (${sql.raw(quotedList(SET_SOURCES))})`,
    ),
    index("push_set_user_local_date_idx").on(table.userId, table.localDate),
    index("push_set_user_occurred_at_idx").on(table.userId, table.occurredAt),
    index("push_set_user_updated_at_idx").on(table.userId, table.updatedAt),
  ],
);

// ---------------------------------------------------------------------------
// Domain: rest_days — an explicitly logged rest day satisfies the weekly
// target (docs/decisions.md #4). Toggled via rest.mark / rest.unmark.
// ---------------------------------------------------------------------------

export const restDays = pgTable(
  "rest_day",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    localDate: date("local_date", { mode: "string" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.localDate] })],
);

// ---------------------------------------------------------------------------
// Domain: daily_stats — a derived rollup, recomputed from scratch after
// each write that could affect it (see src/server/services/daily-stats.ts;
// not a real DB transaction — see docs/architecture.md §3 for why). This
// is a cache of an aggregate, not a source of truth: it is always fully
// recomputable from push_sets and rest_days (docs/decisions.md #8).
// ---------------------------------------------------------------------------

export const dailyStats = pgTable(
  "daily_stat",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    localDate: date("local_date", { mode: "string" }).notNull(),
    totalReps: integer("total_reps").notNull().default(0),
    setCount: integer("set_count").notNull().default(0),
    volumeLoad: numeric("volume_load", {
      precision: 8,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    firstAt: timestamp("first_at", { withTimezone: true }),
    lastAt: timestamp("last_at", { withTimezone: true }),
    topVariationId: text("top_variation_id").references(() => variations.id),
    isRestDay: boolean("is_rest_day").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.userId, table.localDate] })],
);

// ---------------------------------------------------------------------------
// Domain: user_settings — one row per user, created with defaults when the
// user is created (see src/server/auth/index.ts `events.createUser`).
// ---------------------------------------------------------------------------

export const userSettings = pgTable("user_setting", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  weeklyTargetDays: smallint("weekly_target_days").notNull().default(5),
  dailyRepGoal: integer("daily_rep_goal").notNull().default(50),
  reminderTime: time("reminder_time"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  tz: text("tz").notNull().default("UTC"),
  dayStartOffsetMinutes: integer("day_start_offset_minutes").notNull().default(0),
  hapticsEnabled: boolean("haptics_enabled").notNull().default(true),
  disclaimerAcceptedAt: timestamp("disclaimer_accepted_at", { withTimezone: true }),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Domain: push_subscriptions — Web Push endpoints (Phase 5). `last_success_at`
// is both endpoint health and the daily-cap clock (docs/decisions.md #13).
// ---------------------------------------------------------------------------

export const pushSubscriptions = pgTable("push_subscription", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
