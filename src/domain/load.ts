import { addDays, enumerateDates } from "@/domain/date";
import type { DayStatus } from "@/domain/streak";

export const ACUTE_DAYS = 7;
export const CHRONIC_DAYS = 28;
export const CHRONIC_WEEKS = 4;
/** Visible ACWR line — contested heuristic, not a diagnosis. */
export const RAMP_RATIO_THRESHOLD = 1.5;
export const SHOULDER_DAY_REPS = 150;
export const PULL_TRAINING_DAYS = 4;
/** Don't fire ramp until the 28-day window has some real baseline. */
export const RAMP_MIN_ACTIVE_DAYS = 7;

export type EducationalCardId = "ramp" | "shoulder" | "pull";

export interface LoadSnapshot {
  acuteLoad: number;
  chronicWeeklyLoad: number;
  ratio: number | null;
  acuteFrom: string;
  chronicFrom: string;
}

function indexDays(days: Iterable<DayStatus>): Map<string, DayStatus> {
  const byDate = new Map<string, DayStatus>();
  for (const day of days) byDate.set(day.localDate, day);
  return byDate;
}

export function sumVolumeLoad(
  byDate: ReadonlyMap<string, DayStatus>,
  from: string,
  to: string,
): number {
  let total = 0;
  for (const date of enumerateDates(from, to)) {
    total += byDate.get(date)?.volumeLoad ?? 0;
  }
  return total;
}

/**
 * Acute = last 7 days of volume_load. Chronic = last 28 days averaged
 * into a week (sum / 4). Ratio is acute / chronic. Empty chronic means
 * no ratio rather than Infinity.
 */
export function computeLoad(input: {
  days: Iterable<DayStatus>;
  today: string;
}): LoadSnapshot {
  const byDate = indexDays(input.days);
  const acuteFrom = addDays(input.today, -(ACUTE_DAYS - 1));
  const chronicFrom = addDays(input.today, -(CHRONIC_DAYS - 1));
  const acuteLoad = sumVolumeLoad(byDate, acuteFrom, input.today);
  const chronicTotal = sumVolumeLoad(byDate, chronicFrom, input.today);
  const chronicWeeklyLoad = chronicTotal / CHRONIC_WEEKS;
  const ratio = chronicWeeklyLoad > 0 ? acuteLoad / chronicWeeklyLoad : null;
  return { acuteLoad, chronicWeeklyLoad, ratio, acuteFrom, chronicFrom };
}

export function selectEducationalCard(input: {
  days: Iterable<DayStatus>;
  today: string;
  ratio: number | null;
}): EducationalCardId | null {
  const byDate = indexDays(input.days);
  const week = enumerateDates(addDays(input.today, -(ACUTE_DAYS - 1)), input.today);
  const chronic = enumerateDates(
    addDays(input.today, -(CHRONIC_DAYS - 1)),
    input.today,
  );
  const baselineDays = chronic.filter(
    (date) => (byDate.get(date)?.volumeLoad ?? 0) > 0,
  ).length;

  if (
    input.ratio !== null &&
    input.ratio >= RAMP_RATIO_THRESHOLD &&
    baselineDays >= RAMP_MIN_ACTIVE_DAYS
  ) {
    return "ramp";
  }

  if (week.some((date) => (byDate.get(date)?.totalReps ?? 0) >= SHOULDER_DAY_REPS)) {
    return "shoulder";
  }

  const trainingDays = week.filter(
    (date) => (byDate.get(date)?.setCount ?? 0) > 0,
  ).length;
  if (trainingDays >= PULL_TRAINING_DAYS) return "pull";

  return null;
}

export const EDUCATIONAL_CARDS: Record<
  EducationalCardId,
  { title: string; body: string; threshold: string }
> = {
  ramp: {
    title: "That's a fast jump",
    body: "This week's load is well above your last four-week average. Ease off or take a rest day. Muscle grows during recovery, not during the binge.",
    threshold: `Fires at ${RAMP_RATIO_THRESHOLD}× (this week's volume_load ÷ the average week of the last ${CHRONIC_DAYS} days). A rough, contested sports-science heuristic — not a diagnosis, not a recovery score.`,
  },
  shoulder: {
    title: "Shoulders remember",
    body: "A very big day of pushing is hard on the joint, especially with sloppy lockout. If anything feels sharp, stop. Soreness that fades is normal; pain that worsens is not.",
    threshold: `Fires when any day in the last ${ACUTE_DAYS} reached ${SHOULDER_DAY_REPS} reps.`,
  },
  pull: {
    title: "Pushing without pulling",
    body: "Push-ups train the pushing muscles. On their own they build an unbalanced upper body, so include pulling work like rows or pull-ups. This app does not track that on purpose.",
    threshold: `Fires after ${PULL_TRAINING_DAYS} training days in the last ${ACUTE_DAYS}, when the ramp and shoulder cards are not already showing.`,
  },
};

function trained(localDate: string, volumeLoad: number, totalReps = volumeLoad): DayStatus {
  return {
    localDate,
    setCount: 1,
    totalReps,
    volumeLoad,
    isRestDay: false,
  };
}

/**
 * 21 quiet days at 20 load, then 7 binge days at 80. Against a 28-day
 * window this produces ratio ≈ 2.29, which is how the ramp card is proven.
 */
export function rampScenarioDays(today: string): DayStatus[] {
  const days: DayStatus[] = [];
  for (let ago = CHRONIC_DAYS - 1; ago >= 0; ago -= 1) {
    const date = addDays(today, -ago);
    const binge = ago < ACUTE_DAYS;
    days.push(trained(date, binge ? 80 : 20));
  }
  return days;
}
