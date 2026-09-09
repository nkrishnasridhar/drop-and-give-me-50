"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DISCLAIMER_TEXT } from "@/domain/disclaimer";
import { useSettings } from "@/features/settings/use-settings";
import { useTRPC } from "@/lib/trpc";
import styles from "./settings-screen.module.css";

const OFFSET_OPTIONS = [
  { minutes: 0, label: "Midnight" },
  { minutes: 60, label: "1:00 am" },
  { minutes: 120, label: "2:00 am" },
  { minutes: 180, label: "3:00 am" },
  { minutes: 240, label: "4:00 am" },
] as const;

export function SettingsScreen() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const settings = useSettings();
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useMutation(
    trpc.settings.update.mutationOptions({
      retry: 2,
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.settings.get.pathFilter());
        await queryClient.invalidateQueries(trpc.days.today.pathFilter());
        await queryClient.invalidateQueries(trpc.days.range.pathFilter());
        await queryClient.invalidateQueries(trpc.stats.pathFilter());
      },
    }),
  );

  async function save(
    patch: Parameters<typeof update.mutateAsync>[0],
  ): Promise<void> {
    setError(null);
    try {
      await update.mutateAsync(patch);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save that setting.",
      );
    }
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Settings</h1>

      <label className={styles.field}>
        <span>Weekly target</span>
        <select
          value={settings.weeklyTargetDays}
          disabled={update.isPending || settings.isLoading}
          onChange={(event) =>
            void save({ weeklyTargetDays: Number(event.target.value) })
          }
        >
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <option key={days} value={days}>
              {days} day{days === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Daily rep goal</span>
        <input
          type="number"
          min={1}
          max={500}
          defaultValue={settings.dailyRepGoal}
          key={settings.dailyRepGoal}
          disabled={update.isPending || settings.isLoading}
          onBlur={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            if (!Number.isInteger(next) || next < 1 || next > 500) {
              event.target.value = String(settings.dailyRepGoal);
              return;
            }
            if (next !== settings.dailyRepGoal) void save({ dailyRepGoal: next });
          }}
        />
      </label>

      <label className={styles.field}>
        <span>Day starts at</span>
        <select
          value={settings.dayStartOffsetMinutes}
          disabled={update.isPending || settings.isLoading}
          onChange={(event) =>
            void save({
              dayStartOffsetMinutes: Number(event.target.value) as
                | 0
                | 60
                | 120
                | 180
                | 240,
            })
          }
        >
          {OFFSET_OPTIONS.map((option) => (
            <option key={option.minutes} value={option.minutes}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.toggle}>
        <span>Haptics</span>
        <input
          type="checkbox"
          checked={settings.hapticsEnabled}
          disabled={update.isPending || settings.isLoading}
          onChange={(event) =>
            void save({ hapticsEnabled: event.target.checked })
          }
        />
      </label>

      <button
        type="button"
        className={styles.linkish}
        onClick={() => setDisclaimerOpen((open) => !open)}
      >
        {disclaimerOpen ? "Hide disclaimer" : "Read the health disclaimer"}
      </button>
      {disclaimerOpen && <p className={styles.disclaimer}>{DISCLAIMER_TEXT}</p>}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
