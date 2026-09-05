"use client";

import { motion } from "motion/react";
import {
  FAMILY_LABELS,
  FAMILY_ORDER,
  type VariationOption,
} from "@/features/logging/types";
import styles from "./log-screen.module.css";

interface VariationSheetProps {
  open: boolean;
  variations: VariationOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  nested?: boolean;
}

export function VariationSheet({
  open,
  variations,
  selectedId,
  onSelect,
  onClose,
  nested = false,
}: VariationSheetProps) {
  if (!open) return null;

  const grouped = FAMILY_ORDER.map((family) => ({
    family,
    items: variations.filter((variation) => variation.family === family),
  })).filter((group) => group.items.length > 0);

  return (
    <div className={nested ? `${styles.sheetRoot} ${styles.sheetRootNested}` : styles.sheetRoot}>
      <button
        type="button"
        className={styles.sheetBackdrop}
        aria-label="Close variation list"
        onClick={onClose}
      />
      <motion.div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="variation-sheet-title"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      >
        <div className={styles.sheetHandle} />
        <h2 id="variation-sheet-title" className={styles.sheetTitle}>
          Variation
        </h2>
        <p className={styles.sheetHint}>
          Intensity is load relative to a regular push-up. Shown, never hidden.
        </p>
        <div className={styles.sheetList}>
          {grouped.map((group) => (
            <section key={group.family} className={styles.sheetGroup}>
              <h3 className={styles.sheetGroupTitle}>
                {FAMILY_LABELS[group.family]}
              </h3>
              {group.items.map((variation) => {
                const selected = variation.id === selectedId;
                return (
                  <button
                    key={variation.id}
                    type="button"
                    className={
                      selected ? styles.sheetItemSelected : styles.sheetItem
                    }
                    onClick={() => {
                      onSelect(variation.id);
                      onClose();
                    }}
                  >
                    <span className={styles.sheetItemName}>{variation.name}</span>
                    <span className={styles.sheetItemMeta}>
                      ×{variation.intensityFactor.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
