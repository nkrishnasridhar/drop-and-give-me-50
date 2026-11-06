# Product decisions

These were made deliberately, after weighing real alternatives, to close off
specific recurring failure modes in habit-tracking and fitness apps. Revisit
one only if its stated trigger condition occurs.

1. **`push_sets` is flat and atomic.** There is no workout, session, program,
   or plan entity, ever. A "set" is one drop-and-do-it event. Same-day sets
   are grouped for display only, never stored as a parent object. Adding a
   workout/session entity is the first step toward becoming a generic
   fitness tracker, which is explicitly out of scope.

2. **Set IDs are client-generated UUIDv7, never server-generated.** This is
   what makes offline retry safe: the client can write locally, queue the
   write, and retry indefinitely against the same ID without risking
   duplicate rows if a request succeeds server-side but the response is
   lost.

3. **`local_date` is computed once, at write time, and stored.** It is never
   derived from UTC at read time. Bucketing by UTC-derived date is the
   single most common timezone bug in habit trackers (a push-up set at
   11:40pm shows up on the wrong day, silently breaking a streak).

4. **The streak is weekly, not daily.** It counts consecutive weeks in which
   the user hit a target number of active days (default 5 of 7). An
   explicitly logged rest day counts as a completed day. There is no daily
   unbroken chain. A daily streak directly contradicts the project's own
   health philosophy — "never shame users for taking recovery days" — by
   making rest expensive. See [prd.md](./prd.md#health-philosophy) for the
   long-form rationale.

5. **No recovery score.** Nothing in this product outputs a single number
   claiming to represent readiness or recovery. Recovery is genuinely
   multi-factorial (sleep, HRV, soreness, RPE) and this app measures none of
   it. Instead: transparent volume numbers (rolling 7-day load vs. a 28-day
   baseline) and a small number of rule-based educational cards whose
   trigger thresholds are visible to the user, never hidden behind a
   proprietary formula.

6. **One Next.js application on Vercel, one Postgres database on Neon,
   Drizzle as the only ORM/migration tool.** No monorepo, no second
   service, no message queue. At this user count and feature set, splitting
   services adds operational surface area without adding capability.

7. **tRPC is the only application API surface.** No parallel REST or
   GraphQL API. A thin REST facade may be added later purely as a portfolio
   artifact, but it is never the primary integration point.

8. **Streaks, personal records, and achievements are always derived from
   `push_sets` and `daily_stats`, never stored as their own source of
   truth.** Storing derived state directly is the classic mistake here: it
   produces numbers that cannot be recomputed after a bug and silently
   drift from the data that supposedly backs them.

9. **One dark theme, one accent colour. No theming system.** A light/dark
   toggle and a theming abstraction are real engineering surface for zero
   product value in a single-user-styled app.

10. **Variations are seeded reference data with an `intensity_factor`. No
    progression graph between variations, no video library.** Progression
    paths are workout programming, which this app explicitly refuses to
    become.

11. **No social features of any kind** — no friends, feeds, leaderboards, or
    comparisons. Named as a non-goal from the outset.

12. **Writes go to local storage before the network, always.** The UI never
    blocks on a request to log a set. This is the single most important
    contributor to the sub-5-second logging guardrail.

13. **Maximum one push notification per day.** More than one reminder a day
    is nagging, not motivating, and the fastest way to get the app's
    notifications disabled outright.

14. **The only condition that reopens the question of a native app is
    wanting a true Android home-screen widget.** A PWA cannot provide one.
    Nothing else — not push reliability, not install friction, not app
    store presence — is sufficient justification on its own.
