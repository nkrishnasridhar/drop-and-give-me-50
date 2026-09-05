"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  HEATMAP_WEEK_COUNT,
  heatmapLevel,
  heatmapMonthLabels,
  heatmapWeeks,
  maxVolume,
  type HeatLevel,
} from "@/domain/heatmap";
import type { DayStatus } from "@/domain/streak";
import styles from "./history-screen.module.css";

const CELL = 11;
const GAP = 3;
const PAD_LEFT = 18;
const PAD_TOP = 16;

function fillFor(level: HeatLevel): string {
  if (level === "rest") return "var(--heat-rest)";
  return `var(--heat-${level})`;
}

function cellLabel(date: string, day: DayStatus | undefined): string {
  if (!day) return `${date}, no activity`;
  if (day.isRestDay && day.setCount === 0) return `${date}, rest day`;
  return `${date}, ${day.totalReps} reps`;
}

interface HeatmapProps {
  today: string;
  days: ReadonlyMap<string, DayStatus>;
  selectedDate: string;
  onSelect: (date: string) => void;
}

export function Heatmap({ today, days, selectedDate, onSelect }: HeatmapProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const weeks = useMemo(() => heatmapWeeks(today, HEATMAP_WEEK_COUNT), [today]);
  const peak = useMemo(() => maxVolume(days.values()), [days]);
  const months = useMemo(() => heatmapMonthLabels(weeks), [weeks]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollLeft = node.scrollWidth;
  }, [weeks.length, today]);

  const width = PAD_LEFT + weeks.length * (CELL + GAP);
  const height = PAD_TOP + 7 * (CELL + GAP);

  return (
    <div className={styles.heatmapSection}>
      <div className={styles.heatmapWrap} ref={scroller}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Daily volume heatmap"
        >
          {months.map((month) => (
            <text
              key={`${month.label}-${month.weekIndex}`}
              x={PAD_LEFT + month.weekIndex * (CELL + GAP)}
              y={11}
              className={styles.heatmapMonth}
            >
              {month.label}
            </text>
          ))}
          {["M", "", "W", "", "F", "", ""].map((label, row) =>
            label ? (
              <text
                key={row}
                x={0}
                y={PAD_TOP + row * (CELL + GAP) + CELL - 1}
                className={styles.heatmapWeekday}
              >
                {label}
              </text>
            ) : null,
          )}
          {weeks.map((week, weekIndex) =>
            week.map((date, row) => {
              const future = date > today;
              const day = days.get(date);
              const level = future ? 0 : heatmapLevel(day, peak);
              const selected = date === selectedDate;
              const x = PAD_LEFT + weekIndex * (CELL + GAP);
              const y = PAD_TOP + row * (CELL + GAP);
              return (
                <rect
                  key={date}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={fillFor(level)}
                  className={selected ? styles.heatSelected : styles.heatCell}
                  role="button"
                  tabIndex={future ? -1 : 0}
                  aria-label={cellLabel(date, day)}
                  aria-pressed={selected}
                  aria-disabled={future || undefined}
                  onClick={() => {
                    if (!future) onSelect(date);
                  }}
                  onKeyDown={(event) => {
                    if (future) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(date);
                    }
                  }}
                />
              );
            }),
          )}
        </svg>
      </div>
      <div className={styles.legend} aria-hidden="true">
        <span>Less</span>
        <span className={styles.legendSwatch} style={{ background: "var(--heat-0)" }} />
        <span className={styles.legendSwatch} style={{ background: "var(--heat-1)" }} />
        <span className={styles.legendSwatch} style={{ background: "var(--heat-2)" }} />
        <span className={styles.legendSwatch} style={{ background: "var(--heat-3)" }} />
        <span className={styles.legendSwatch} style={{ background: "var(--heat-4)" }} />
        <span>More</span>
        <span
          className={styles.legendSwatch}
          style={{ background: "var(--heat-rest)" }}
        />
        <span>Rest</span>
      </div>
    </div>
  );
}
