"use client";

import { useEffect, useState } from "react";
import type { variations } from "@/server/db/schema";
import { trpcClient } from "@/lib/trpc-client";
import { generateUuidV7 } from "@/lib/uuid";

type Variation = typeof variations.$inferSelect;

interface LogFormProps {
  variations: Variation[];
}

interface TodayTotals {
  totalReps: number;
  setCount: number;
}

/**
 * Phase 1's deliberately minimal logging surface — no presets, no
 * haptics, no offline queue, no optimistic UI. Those are Phase 2's job
 * (docs/architecture.md §8). This proves the write path end to end:
 * client generates the ID, calls sets.log, and today's total refreshes
 * from the server afterward.
 */
export function LogForm({ variations }: LogFormProps) {
  const [variationId, setVariationId] = useState(variations[0]?.id ?? "");
  const [reps, setReps] = useState("");
  const [note, setNote] = useState("");
  const [today, setToday] = useState<TodayTotals | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function refreshToday() {
    const result = await trpcClient.days.today.query({ tz: timeZone });
    setToday({ totalReps: result.totalReps, setCount: result.setCount });
  }

  useEffect(() => {
    // The correct fix here is TanStack Query's useQuery, which handles
    // fetch-on-mount without this pattern — but that's a Phase 2
    // dependency (docs/architecture.md §1: it arrives with the IndexedDB
    // outbox), not one to pull forward just to satisfy a lint rule for
    // code this component will no longer contain once Phase 2 lands.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshToday().catch((err: unknown) => {
      console.error("Failed to load today's total", err);
    });
    // Only ever needs to run once per mount — timeZone is stable for the
    // life of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const repsValue = Number.parseInt(reps, 10);
    if (!Number.isInteger(repsValue) || repsValue < 1 || repsValue > 500) {
      setError("Enter a number of reps between 1 and 500.");
      return;
    }
    if (!variationId) {
      setError("Choose a variation.");
      return;
    }

    setIsSubmitting(true);
    try {
      await trpcClient.sets.log.mutate({
        id: generateUuidV7(),
        variationId,
        reps: repsValue,
        tz: timeZone,
        note: note.trim() || undefined,
      });
      setReps("");
      setNote("");
      await refreshToday();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log set.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%", maxWidth: "24rem" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ opacity: 0.6, margin: 0 }}>Today</p>
        <p style={{ fontSize: "2.5rem", fontWeight: 700, margin: 0 }}>
          {today ? today.totalReps : "–"}
        </p>
        <p style={{ opacity: 0.6, margin: 0 }}>
          {today ? `${today.setCount} set${today.setCount === 1 ? "" : "s"}` : "loading..."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Variation
          <select
            value={variationId}
            onChange={(event) => setVariationId(event.target.value)}
            style={{ padding: "0.5rem", fontSize: "1rem" }}
          >
            {variations.map((variation) => (
              <option key={variation.id} value={variation.id}>
                {variation.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Reps
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            placeholder="20"
            style={{ padding: "0.5rem", fontSize: "1rem" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Note (optional)
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            style={{ padding: "0.5rem", fontSize: "1rem" }}
          />
        </label>

        {error && <p style={{ color: "#f87171", margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ padding: "0.75rem", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}
        >
          {isSubmitting ? "Logging..." : "Log set"}
        </button>
      </form>
    </div>
  );
}
