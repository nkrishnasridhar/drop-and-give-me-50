import { addDays } from "@/domain/date";
import { weekDotKind, weekRingLabel } from "@/domain/streak";
import styles from "./log-screen.module.css";

const WEEKDAY_DOTS = ["M", "T", "W", "T", "F", "S", "S"];

const DOT_CLASS: Record<ReturnType<typeof weekDotKind>, string> = {
  rest: styles.ringDotRest,
  filled: styles.ringDotFilled,
  future: styles.ringDotFuture,
  empty: styles.ringDot,
};

interface WeekRingProps {
  activeDays: number;
  targetDays: number;
  completedDates: readonly string[];
  restDates: readonly string[];
  weekStart: string;
  today: string;
}

export function WeekRing({
  activeDays,
  targetDays,
  completedDates,
  restDates,
  weekStart,
  today,
}: WeekRingProps) {
  const progress = Math.min(1, activeDays / Math.max(1, targetDays));
  const { shownActive, shownTarget, met } = weekRingLabel({
    activeDays,
    targetDays,
  });
  const ariaLabel = met
    ? `${shownActive} of ${shownTarget} days this week, week met`
    : `${shownActive} of ${shownTarget} days this week`;
  const caption = met
    ? restDates.length > 0
      ? "Week met · rest days count"
      : "Week met"
    : null;

  return (
    <div className={styles.ringBlock}>
      <div className={styles.barRow}>
        <span className={styles.barValue}>
          {shownActive}/{shownTarget}
        </span>
        <div
          className={styles.barTrack}
          role="progressbar"
          aria-valuenow={shownActive}
          aria-valuemin={0}
          aria-valuemax={shownTarget}
          aria-label={ariaLabel}
        >
          <div
            className={styles.barFill}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
      <div className={styles.ringDots} aria-hidden="true">
        {WEEKDAY_DOTS.map((label, index) => {
          const date = addDays(weekStart, index);
          const kind = weekDotKind({
            date,
            today,
            completedDates,
            restDates,
          });
          return (
            <span key={date} className={DOT_CLASS[kind]}>
              {label}
            </span>
          );
        })}
      </div>
      {caption && <p className={styles.ringCaption}>{caption}</p>}
    </div>
  );
}
