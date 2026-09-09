"use client";

import { FAMILY_LABELS } from "@/features/logging/types";
import styles from "./stats-screen.module.css";

export function HourClock({ hours }: { hours: readonly number[] }) {
  const size = 196;
  const cx = size / 2;
  const cy = size / 2;
  const inner = 36;
  const maxBar = 46;
  const peak = Math.max(1, ...hours);

  return (
    <svg
      className={styles.clock}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Sets by hour of day"
    >
      <circle cx={cx} cy={cy} r={inner - 8} fill="var(--surface-2)" />
      {hours.map((count, hour) => {
        const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2;
        const length = inner + (count / peak) * maxBar;
        const x1 = cx + Math.cos(angle) * inner;
        const y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * length;
        const y2 = cy + Math.sin(angle) * length;
        return (
          <line
            key={hour}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={count > 0 ? "var(--accent)" : "var(--border)"}
            strokeWidth={count > 0 ? 3 : 1.5}
            strokeLinecap="round"
          />
        );
      })}
      {["00", "06", "12", "18"].map((label, index) => {
        const angle = (index / 4) * 2 * Math.PI - Math.PI / 2;
        const r = inner + maxBar + 14;
        return (
          <text
            key={label}
            x={cx + Math.cos(angle) * r}
            y={cy + Math.sin(angle) * r}
            textAnchor="middle"
            dominantBaseline="middle"
            className={styles.clockLabel}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export function familyLabel(family: string): string {
  return FAMILY_LABELS[family as keyof typeof FAMILY_LABELS] ?? family;
}
