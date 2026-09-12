"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import type { LogToast } from "@/domain/nudge";
import styles from "./log-screen.module.css";

export function NudgeToast({
  toast,
  onClear,
}: {
  toast: LogToast | null;
  onClear: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onClear, 4000);
    return () => window.clearTimeout(timer);
  }, [toast, onClear]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.p
          key={toast.id + toast.message}
          className={styles.toast}
          role="status"
          aria-live="polite"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 480, damping: 32 }}
        >
          {toast.message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
