import { addDays } from "@/domain/date";
import styles from "./log-screen.module.css";

const WEEKDAY_DOTS = ["M", "T", "W", "T", "F", "S", "S"];

interface WeekRingProps {
  activeDays: number;
  targetDays: number;
  completedDates: readonly string[];
  weekStart: string;
  today: string;
}

export function WeekRing({
  activeDays,
  targetDays,
  completedDates,
  weekStart,
  today,
}: WeekRingProps) {
  const size = 132;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, activeDays / Math.max(1, targetDays));
  const offset = circumference * (1 - progress);
  const completed = new Set(completedDates);

  return (
    <div className={styles.ringBlock}>
      <svg
        className={styles.ringSvg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${activeDays} of ${targetDays} days this week`}
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
          {activeDays}/{targetDays}
        </text>
      </svg>
      <div className={styles.ringDots} aria-hidden="true">
        {WEEKDAY_DOTS.map((label, index) => {
          const date = addDays(weekStart, index);
          const future = date > today;
          const filled = !future && completed.has(date);
          return (
            <span
              key={date}
              className={
                filled
                  ? styles.ringDotFilled
                  : future
                    ? styles.ringDotFuture
                    : styles.ringDot
              }
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
