import { addDays, startOfWeekMonday } from "@/domain/date";
import type { DayStatus } from "@/domain/streak";

export type HeatLevel = 0 | 1 | 2 | 3 | 4 | "rest";

/**
 * Volume buckets relative to the busiest day in the window, so a quiet
 * month still has contrast and a binge week doesn't paint everything
 * the same accent. Rest days with no reps get their own cell so they
 * read as completed, not empty.
 */
export function heatmapLevel(
  day: DayStatus | undefined,
  maxVolume: number,
): HeatLevel {
  if (!day) return 0;
  if (day.isRestDay && day.totalReps === 0 && day.setCount === 0) return "rest";
  if (day.volumeLoad <= 0 && day.totalReps <= 0) return 0;

  const volume = day.volumeLoad > 0 ? day.volumeLoad : day.totalReps;
  if (maxVolume <= 0) return 1;
  const ratio = volume / maxVolume;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export function maxVolume(days: Iterable<DayStatus>): number {
  let max = 0;
  for (const day of days) {
    const volume = day.volumeLoad > 0 ? day.volumeLoad : day.totalReps;
    if (volume > max) max = volume;
  }
  return max;
}

export const HEATMAP_WEEK_COUNT = 53;

export function heatmapMonthLabels(
  weeks: readonly (readonly string[])[],
): { weekIndex: number; label: string }[] {
  const labels: { weekIndex: number; label: string }[] = [];
  let previous = "";
  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    const monday = weeks[weekIndex]?.[0];
    if (!monday) continue;
    const label = monthLabel(monday);
    if (label === previous) continue;
    previous = label;
    const last = labels[labels.length - 1];
    if (last && weekIndex - last.weekIndex < 2) continue;
    labels.push({ weekIndex, label });
  }
  return labels;
}

/** Oldest Monday → this week's Sunday, 7 rows (Mon–Sun) per column. */
export function heatmapWeeks(today: string, weekCount: number): string[][] {
  const count = Math.max(1, weekCount);
  const thisMonday = startOfWeekMonday(today);
  const firstMonday = addDays(thisMonday, -7 * (count - 1));
  const weeks: string[][] = [];
  for (let week = 0; week < count; week += 1) {
    const monday = addDays(firstMonday, 7 * week);
    weeks.push(Array.from({ length: 7 }, (_, day) => addDays(monday, day)));
  }
  return weeks;
}

export function monthLabel(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
}
