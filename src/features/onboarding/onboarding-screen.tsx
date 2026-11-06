"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DISCLAIMER_TEXT } from "@/domain/disclaimer";
import { useTRPC } from "@/lib/trpc";
import styles from "./onboarding-screen.module.css";

const CARDS = [
  {
    title: "The set is the whole workout",
    body: "Drop, do the reps, log in one tap. No programs, no sessions, no planner. Last-used variation, then the counter. That's the product.",
  },
  {
    title: "Rest is part of the week",
    body: "The streak counts weeks, not unbroken days. An explicit rest day counts. Consistency over intensity — the fastest way to lose a month is to earn an injury in a week.",
  },
] as const;

export function OnboardingScreen() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const complete = useMutation(
    trpc.settings.completeOnboarding.mutationOptions({
      retry: 2,
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.settings.get.pathFilter());
        router.refresh();
        router.push("/");
      },
    }),
  );

  const isDisclaimer = step >= CARDS.length;

  return (
    <div className={styles.screen}>
      <p className={styles.progress}>
        {step + 1} / {CARDS.length + 1}
      </p>
      {isDisclaimer ? (
        <>
          <h1 className={styles.title}>Before you start</h1>
          <p className={styles.body}>{DISCLAIMER_TEXT}</p>
        </>
      ) : (
        <>
          <h1 className={styles.title}>{CARDS[step].title}</h1>
          <p className={styles.body}>{CARDS[step].body}</p>
        </>
      )}
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        {step > 0 && (
          <button
            type="button"
            className={styles.secondary}
            disabled={complete.isPending}
            onClick={() => {
              setError(null);
              setStep((current) => current - 1);
            }}
          >
            Back
          </button>
        )}
        {isDisclaimer ? (
          <button
            type="button"
            className={styles.primary}
            disabled={complete.isPending}
            onClick={() => {
              setError(null);
              void complete.mutateAsync().catch((caught: unknown) => {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Could not save that.",
                );
              });
            }}
          >
            I understand
          </button>
        ) : (
          <button
            type="button"
            className={styles.primary}
            onClick={() => setStep((current) => current + 1)}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
