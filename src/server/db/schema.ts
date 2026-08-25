/**
 * Domain tables (push_sets, variations, rest_days, daily_stats,
 * user_settings, push_subscriptions) are introduced in Phase 1 — see
 * docs/architecture.md §5 for the full schema design.
 *
 * This file exists now, ahead of any tables, so that:
 *  - `drizzle.config.ts` has a stable schema path to point at, and
 *  - the CI migration-drift check (`npm run db:generate` + `git diff`)
 *    is wired up from day one instead of being retrofitted in Phase 1.
 */
export {};
