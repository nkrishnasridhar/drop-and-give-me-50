"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DISCLAIMER_TEXT } from "@/domain/disclaimer";
import { DEFAULT_REMINDER_TIME } from "@/domain/reminder";
import { useTimeZone } from "@/features/logging/use-today";
import { usePushActions, pushSupported } from "@/features/settings/use-push";
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
  const tz = useTimeZone();
  const push = usePushActions();
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

  const busy = update.isPending || settings.isLoading || push.isPending;

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

  async function toggleReminder(enabled: boolean): Promise<void> {
    setError(null);
    try {
      if (enabled) {
        await push.enable(tz);
        await update.mutateAsync({
          reminderEnabled: true,
          reminderTime: settings.reminderTime || DEFAULT_REMINDER_TIME,
          tz,
        });
      } else {
        await update.mutateAsync({ reminderEnabled: false, tz });
        await push.disable();
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update reminders.",
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
          disabled={busy}
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
          disabled={busy}
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
          disabled={busy}
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
          disabled={busy}
          onChange={(event) =>
            void save({ hapticsEnabled: event.target.checked })
          }
        />
      </label>

      <label className={styles.toggle}>
        <span>Daily reminder</span>
        <input
          type="checkbox"
          checked={settings.reminderEnabled}
          disabled={busy || !pushSupported()}
          onChange={(event) => void toggleReminder(event.target.checked)}
        />
      </label>

      <label className={styles.field}>
        <span>Reminder time</span>
        <input
          type="time"
          step={900}
          value={settings.reminderTime}
          disabled={busy}
          onChange={(event) => {
            const next = event.target.value;
            if (next && next !== settings.reminderTime) {
              void save({ reminderTime: next, tz });
            }
          }}
        />
      </label>
      <p className={styles.hint}>
        At most one nudge a day, in this device&apos;s timezone. Skipped if
        you already logged or rested. A test counts as today&apos;s send.
      </p>

      {settings.reminderEnabled && (
        <button
          type="button"
          className={styles.linkish}
          disabled={busy}
          onClick={() => {
            setError(null);
            void push.sendTest().catch((caught: unknown) => {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Could not send a test notification.",
              );
            });
          }}
        >
          Send a test notification
        </button>
      )}

      {!pushSupported() && (
        <p className={styles.hint}>
          This browser cannot receive web push. Android Chrome can, after
          install.
        </p>
      )}

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
