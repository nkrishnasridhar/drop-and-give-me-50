# Case study: Drop and Give Me 50

Lead with the cuts. The interesting engineering is what was refused, and
the two decisions that made the rest of the app small.

## What was cut

Removed from consideration, not saved for later:

- **Any exercise other than push-ups.** The moment pull-ups get a rep
  field, this is a generic tracker that happens to include push-ups. The
  product is the constraint.
- **Workouts, sessions, programs, rest timers, skill trees.** A set is one
  drop-and-do-it event. Same-day sets are grouped for display only. There
  is no parent object to attach a program to, which is the point.
- **AI, camera-counted reps, social, XP, theming, a charting library,
  a second service.** None of those answer a question this app actually
  has. The heatmap and week dots are hand-built SVG. Rewards are derived
  from logs, not stored. Auth is Google, one Next.js app, one Postgres
  database.
- **Badges, custom variations, a pulling check-in, heatmap export.** None
  of those are in the app. The North Star does not need them.

## Why those cuts

The North Star is Weekly Consistency Rate — trailing 12 weeks that met the
user's own target — not lifetime reps, not badges earned. Lifetime reps
only ever go up, so they cannot tell you the habit is dying. Consistency
can fall, which is the entire reason to measure it.

The logging guardrail is median time-to-log under five seconds. Every
cut above is a cut that would have added a screen, a choice, or a wait
between "I just did a set" and "it is in the log." Camera counting is
slower than tapping 20. A workout builder is a different product. A
daily streak would punish the rest days the health philosophy requires.

## Two technical decisions a reviewer should look at first

**Offline outbox, not "optimistic UI plus a spinner."** Writes go to
IndexedDB with a client-generated UUIDv7 before the network is involved.
The UI updates from that local row. The service worker and an `online`
listener drain the outbox against `sets.log`, which upserts on `id`. A
request that succeeds on the server and dies before the client hears back
is safe to retry. Last-write-wins on `updated_at` is enough for one human
across a couple of devices; CRDTs are not. The mandatory proof of this
path is the Playwright test: install the service worker, go offline, tap
Log 20 three times, reconnect, and assert the outbox is empty and
Postgres has three rows.

**Rewards are a read model.** Streaks, PRs, milestones, and the week dots
are computed from `push_sets` and `daily_stats`. `daily_stats` itself is a
derived cache, fully recomputed for a day after any write that could
affect it. There is no `achievements` table to drift from the log. That
is why a year of synthetic data is a seed script (`source: "backfill"`,
`note: "demo-year"`) against the same tables a real user writes, not a
demo flag or a second API.

## What shipped instead

Four screens: Log, History, Stats, Settings. Log is a counter that
remembers the last rep count, the last variation, and one Log button.
An installable PWA with Log 20 / Log 50 shortcuts. A heatmap that is the
actual retention engine. A weekly streak that counts rest. Load as a
visible 7-day vs 28-day ratio with three
educational cards, not a recovery score. At most one push reminder per
local day. A health disclaimer that is a log's honest limit, not theatre.

## Demo

An empty heatmap sells nothing. Seed a real account with a year of
imperfect training:

```bash
# DEMO_SEED_USER_ID is the Auth.js user uuid (Neon `user.id`)
npm run db:seed:demo
```

The generator is a pure function (`src/domain/demo-year.ts`). Most weeks
hit a five-day target; some miss; rest days are explicit; volume ramps
then holds so the binge card stays quiet. Today is left empty so a live
log still has somewhere to go.

## What would reopen a cut

Named in [docs/decisions.md](./decisions.md). A native app reopens only
for a true Android home-screen widget. A second API reopens only as a
thin portfolio facade, never as the write path.
