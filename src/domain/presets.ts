export const DEFAULT_PRESETS = [10, 20, 50] as const;

/**
 * Three one-tap amounts. Until there is enough history the defaults
 * stay: 10 / 20 / 50, matching the name of the app and the two
 * manifest shortcuts. Once the user has logged a handful of sets, the
 * chips become the three most-used sizes so the fastest tap is the
 * one they actually do.
 */
export function learnPresets(recentReps: readonly number[]): number[] {
  if (recentReps.length < 5) {
    return [...DEFAULT_PRESETS];
  }

  const counts = new Map<number, number>();
  for (const reps of recentReps) {
    if (!Number.isInteger(reps) || reps < 1 || reps > 500) continue;
    counts.set(reps, (counts.get(reps) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] - b[0];
  });

  const top = ranked.slice(0, 3).map(([reps]) => reps);

  for (const fallback of DEFAULT_PRESETS) {
    if (top.length >= 3) break;
    if (!top.includes(fallback)) top.push(fallback);
  }

  return top.sort((a, b) => a - b);
}
