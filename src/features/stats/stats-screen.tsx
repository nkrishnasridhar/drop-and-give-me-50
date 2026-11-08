"use client";

import { useQuery } from "@tanstack/react-query";
import { formatCivilDay } from "@/domain/date";
import { RAMP_RATIO_THRESHOLD } from "@/domain/load";
import { useIsClient, useTimeZone } from "@/features/logging/use-today";
import { familyLabel, HourClock } from "@/features/stats/hour-clock";
import { useTRPC } from "@/lib/trpc";
import styles from "./stats-screen.module.css";

function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatRatio(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${ratio.toFixed(2)}×`;
}

export function StatsScreen() {
  const trpc = useTRPC();
  const tz = useTimeZone();
  const isClient = useIsClient();
  const overview = useQuery({
    ...trpc.stats.overview.queryOptions({ tz }),
    enabled: isClient,
    placeholderData: (previous) => previous,
  });
  const load = useQuery({
    ...trpc.stats.load.queryOptions({ tz }),
    enabled: isClient,
    placeholderData: (previous) => previous,
  });

  const data = overview.data;
  const loadData = load.data;
  const empty = (data?.lifetimeSets ?? 0) === 0 && !overview.isLoading;
  const failed = overview.isError || load.isError;

  return (
    <div className={styles.screen}>
      {failed && (
        <p className={styles.empty}>Could not load stats. Try again online.</p>
      )}
      <section className={styles.hero}>
        <p className={styles.kicker}>Weeks on target</p>
        <p className={styles.heroValue}>
          {data ? formatRate(data.consistency.rate) : "—"}
        </p>
        <p className={styles.heroMeta}>
          {data
            ? `${data.consistency.met} of ${data.consistency.considered} weeks hit your ${data.weeklyTargetDays}-day goal`
            : "How often you met your weekly goal"}
        </p>
      </section>

      {loadData && (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Volume</h2>
          <p className={styles.loadRow}>
            <span>This week</span>
            <strong>{Math.round(loadData.acuteLoad)}</strong>
          </p>
          <p className={styles.loadRow}>
            <span>4-week average</span>
            <strong>{Math.round(loadData.chronicWeeklyLoad)}</strong>
          </p>
          <p className={styles.loadRow}>
            <span>This week ÷ average</span>
            <strong>{formatRatio(loadData.ratio)}</strong>
          </p>
          <p className={styles.threshold}>
            Guide line: {RAMP_RATIO_THRESHOLD}×. Rule of thumb only — not
            medical advice.
          </p>
          {loadData.card && (
            <article className={styles.edu}>
              <h3>{loadData.card.title}</h3>
              <p>{loadData.card.body}</p>
              <p className={styles.eduThreshold}>{loadData.card.threshold}</p>
            </article>
          )}
        </section>
      )}

      <section className={styles.grid}>
        <div className={styles.stat}>
          <p className={styles.statValue}>{data?.lifetimeReps ?? 0}</p>
          <p className={styles.statLabel}>Total reps</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{data?.lifetimeSets ?? 0}</p>
          <p className={styles.statLabel}>Total sets</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{data?.streak.current ?? 0}</p>
          <p className={styles.statLabel}>Week streak</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statValue}>{data?.streak.longest ?? 0}</p>
          <p className={styles.statLabel}>Best streak</p>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Records</h2>
        <p className={styles.loadRow}>
          <span>Best day</span>
          <strong>
            {data?.biggestDay
              ? `${data.biggestDay.totalReps} · ${formatCivilDay(data.biggestDay.localDate)}`
              : "—"}
          </strong>
        </p>
        <p className={styles.loadRow}>
          <span>Best set</span>
          <strong>{data?.biggestSetReps ?? "—"}</strong>
        </p>
        <p className={styles.loadRow}>
          <span>Reps per set</span>
          <strong>
            {data && data.lifetimeSets > 0
              ? data.averageRepsPerSet.toFixed(1)
              : "—"}
          </strong>
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>By hour</h2>
        {data ? <HourClock hours={data.hours} /> : null}
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Variations</h2>
        {data?.families.length ? (
          <ul className={styles.familyList}>
            {data.families.map((family) => {
              const peak = data.families[0]?.reps || 1;
              return (
                <li key={family.family} className={styles.familyRow}>
                  <div className={styles.familyHead}>
                    <span>{familyLabel(family.family)}</span>
                    <span>{family.reps}</span>
                  </div>
                  <div className={styles.familyTrack}>
                    <div
                      className={styles.familyFill}
                      style={{ width: `${Math.max(6, (family.reps / peak) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>
            Try a few variations — the split shows up here.
          </p>
        )}
      </section>

      {empty && (
        <p className={styles.empty}>
          Everything here is calculated from your log.
        </p>
      )}
    </div>
  );
}
