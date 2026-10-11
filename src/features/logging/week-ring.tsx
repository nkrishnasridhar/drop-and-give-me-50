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
  const size = 132;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, activeDays / Math.max(1, targetDays));
  const offset = circumference * (1 - progress);
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
      <svg
        className={styles.ringSvg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="middle"
          className={styles.ringValue}
        >
          {shownActive}/{shownTarget}
        </text>
      </svg>
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
