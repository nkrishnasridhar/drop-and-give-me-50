# Drop and Give Me 50 — Product Requirements Document

## 1. Product vision

**Mission.** Make doing push-ups feel the way committing code to GitHub
feels: small, frequent, visibly accumulating, and quietly satisfying.

**Problem statement.** General fitness trackers (Hevy, Strong, Fitbod,
Apple Fitness, Strava) treat every exercise as an interchangeable line item
in a workout. That's correct for programmed training and wrong for a habit
built on doing a small thing constantly throughout the day. Logging one set
of push-ups in a generic tracker means picking an exercise from a long list,
navigating workout/session concepts that don't apply, and closing an app
that was clearly designed for something else. The friction is small but it
is exactly the friction that kills a habit meant to be exercised ten times a
day.

**Target audience and persona.** One primary user: the builder, who wants a
push-up habit that survives busy weeks, does not want to become a
"calisthenics athlete," and wants the act of logging to be as fast as doing
the reps themselves. Every feature decision in this document is filtered
through whether that person would open the app today, not whether it would
impress a hypothetical broader audience.

**Why existing apps don't solve this well.** They optimize for programmed,
infrequent, high-intent sessions (open app, plan workout, execute, log).
This product optimizes for unplanned, frequent, low-intent moments (drop,
do a set, log in one tap, get back to what you were doing). Those are
different interaction models, not the same app with fewer exercises.

**Long-term vision.** A year of consistent use produces something the user
did not have before: a visible, personally-earned record of a habit that
stuck, plus a body of variation and volume data interesting enough to look
at on its own terms — without the app ever asking the user to plan a
workout, follow a program, or compare themselves to anyone else.

## 2. North Star and guardrails

**North Star: Weekly Consistency Rate** — the percentage of the trailing 12
weeks in which active days met or exceeded the user's weekly target.
Lifetime reps was considered and rejected as the North Star because it only
ever increases and therefore can never signal that the habit is failing.
Consistency Rate can go down, which is the entire point of tracking it.

**Guardrails** (regressions here revert the feature that caused them,
regardless of how good that feature looks otherwise):

- **Median time-to-log under 5 seconds**, measured from app open to logged
  confirmation.
- **28-day load stability** — catches volume bingeing, which is the
  realistic injury path this app can actually influence.

**Health check (not a guardrail, a diagnostic):** day-90 retention. Is the
user still logging in week 13. Everything else — stats, badges, heatmaps —
is decoration relative to this question.

## 3. Product philosophy

Optimize for consistency over intensity, habit formation over workout
programming, simplicity over feature quantity, delightful UX over
complexity, interesting data over unnecessary AI, and personal motivation
over social networking. Where there is a trade-off between a generic
fitness app and an excellent push-up app, take the push-up app. Where there
is a trade-off between twenty mediocre features and five excellent ones,
build the five.

This is why the product differs from:

- **Workout apps** — no programs, no periodization, no exercise library
  beyond one movement's variations.
- **Gym loggers** — no sets-of-a-workout concept; a set is atomic and
  freestanding.
- **General habit trackers** — the habit is a specific physical movement
  with real recovery physiology behind it, not an interchangeable checkbox.
- **Push-up challenge apps** ("100 push-ups a day") — those optimize for
  volume and ignore recovery; this app actively pushes back on unsafe
  ramping.

## 4. Core features by version

### MVP (see [architecture.md](./architecture.md) for full technical scope)

Four screens: **Log** (home), **History**, **Stats**, **Settings**. Plus:
3-card onboarding with the health disclaimer, Google sign-in, offline-first
writes, an installable PWA with manifest shortcuts, and a maximum of one
push reminder per day.

Every MVP feature is justified by one of: it is the core logging loop, it
is required for the North Star to be measurable, or it is the minimum
health-safety messaging this app is responsible for given its subject
matter.

### Version 2 (gated — see §8)

Achievements/badges, custom user-defined variations, a weekly one-tap "did
you train pulling?" check-in, shareable image export of the heatmap.

### Version 3 / future ideas

Seasonal challenges, weekly summary emails, multi-device conflict
resolution UI, Google Fit export.

### Explicitly rejected (not deferred — removed from consideration)

- AI or LLM features of any kind. There is no question in this product an
  LLM answers better than a deterministic rule.
- Camera-based rep counting / pose estimation — unreliable, and slower than
  manual entry, which defeats the point.
- Social features: friends, feeds, leaderboards, comparisons.
- XP points and levels — a meaningless second currency layered on reps.
- Progression paths / skill trees between variations — this is workout
  programming.
- Rest timers, set timers, workout builders, supersets, "programs."
- Sound effects and drill-sergeant text-to-speech — novel for four days,
  then irritating, and impossible to unhear once shipped. The military
  voice lives in copy, not audio.
- Light/dark theming system — one deliberately designed dark theme.
- Tracking any exercise other than push-ups — the moment pull-ups get a
  rep field, this stops being a push-up app.
- A charting library — the heatmap and progress ring are simple enough to
  be hand-built as SVG, which is also less code.
- Monorepo, microservices, message queues, container orchestration for a
  single Postgres database.

## 5. Health philosophy

Push-up challenge culture rewards volume and ignores recovery. This app
takes the opposite position: consistency matters more than intensity, and
recovery is part of training, not a lapse in it. Concretely:

- Pushing volume needs to be balanced against pulling work (rows,
  pull-ups) for balanced upper-body development — the app says this, it
  does not program it.
- Shoulder health is a first-class concern given how failure-prone the
  push-up is at high volume with poor form.
- The app never shames a rest day. A rest day is a way to keep the weekly
  streak, not a way to break it (see [decisions.md](./decisions.md#4)).
- Guidance is educational, not restrictive: the app surfaces information
  and gets out of the way. It never blocks logging or gates features based
  on volume.

**Onboarding disclaimer** (short, plain, permanently re-readable from
Settings):

> This app is a log, not a coach, and definitely not a doctor. A few honest
> things before you start. Push-ups train your pushing muscles. On their
> own they build an unbalanced upper body, so include pulling work like
> rows or pull-ups. Muscle grows during recovery, not during the set, so
> rest days are part of the training, not a failure of it. Progress
> gradually; the fastest way to lose a month is to earn an injury in a
> week. Normal training soreness fades in a day or two. Sharp pain, joint
> pain, or pain that gets worse is different, and it means stop. If you
> have an existing condition or injury, talk to a professional before
> starting.

## 6. Habit psychology, applied honestly

- **The heatmap is the retention engine**, not the stats page — it works
  for the same reason the GitHub contribution graph does: accumulated,
  visible, personally-earned history where gaps are legible. This is
  endowment, not manipulation.
- **The 7-day progress ring** exploits the goal-gradient effect
  legitimately, because the goal is one the user set for themselves.
- **The weekly reset** gives a fresh-start effect every week — the antidote
  to "I already broke it, why bother."
- **Loss aversion drives the week-streak**, deliberately weakened from a
  daily chain so the loss is never large enough to justify training
  injured to protect it.
- **Explicitly avoided:** guilt-framed notifications, variable-ratio reward
  mechanics, artificial scarcity, streak-repair purchases, social
  comparison of any kind.

## 7. Statistics and gamification

Meaningful, not decorative: lifetime reps, current and longest week-streak,
biggest single day, average reps per set, variation breakdown by family,
a sessions-by-hour clock, and rolling 7-day load against a 28-day baseline.
Rewards (PRs, milestones, badges) are surfaced in the UI; they are never
success metrics themselves — the North Star is Weekly Consistency Rate, not
the count of badges earned.

## 8. Roadmap and the 30-day gate

Phase 0 (foundations) → Phase 1 (data spine) → Phase 2 (delight/offline) →
Phase 3 (history and streaks) → Phase 4 (stats and health) → Phase 5
(nudges) → Phase 6 (portfolio pass). Full phase-by-phase detail, risks, and
milestones live in [architecture.md](./architecture.md#development-phases).

**No Version 2 feature is built until the user has logged on 30 separate
days.** At that point the app's own `daily_stats` shows what is actually
missing from real use, which is better evidence than anything speculated
today.

## 9. Portfolio framing

Lead any case study with what was cut, not what was built — "I designed
forty features and shipped twelve, here is the reasoning" is a stronger
signal of product judgment than feature count. Technically, lead with the
offline outbox and the discipline of deriving all rewards state from raw
logs rather than storing it, since those are the two decisions a senior
reviewer will notice first. A demo mode seeded with a year of synthetic
data matters for presentation — an empty heatmap sells nothing.
