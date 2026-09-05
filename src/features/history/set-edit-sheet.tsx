"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { VariationOption } from "@/features/logging/types";
import { VariationSheet } from "@/features/logging/variation-sheet";
import type { HistorySet } from "./types";
import styles from "./history-screen.module.css";

interface SetEditSheetProps {
  set: HistorySet | null;
  variations: VariationOption[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: {
    variationId: string;
    reps: number;
    note: string | null;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function SetEditSheet({
  set,
  variations,
  busy,
  error,
  onClose,
  onSave,
  onDelete,
}: SetEditSheetProps) {
  if (!set) return null;
  return (
    <SetEditForm
      key={set.id}
      set={set}
      variations={variations}
      busy={busy}
      error={error}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

function SetEditForm({
  set,
  variations,
  busy,
  error,
  onClose,
  onSave,
  onDelete,
}: Omit<SetEditSheetProps, "set"> & { set: HistorySet }) {
  const [variationId, setVariationId] = useState(set.variationId);
  const [reps, setReps] = useState(set.reps);
  const [note, setNote] = useState(set.note ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedVariation =
    variations.find((variation) => variation.id === variationId) ??
    variations.find((variation) => variation.id === set.variationId);

  return (
    <div className={styles.sheetRoot}>
      <button
        type="button"
        className={styles.sheetBackdrop}
        aria-label="Close edit sheet"
        onClick={onClose}
      />
      <motion.div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-set-title"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      >
        <div className={styles.sheetHandle} />
        <h2 id="edit-set-title" className={styles.sheetTitle}>
          Edit set
        </h2>
        <button
          type="button"
          className={styles.variationChip}
          onClick={() => setPickerOpen(true)}
        >
          {selectedVariation?.name ?? "Variation"}
        </button>
        <div className={styles.editStepper}>
          <button
            type="button"
            aria-label="Decrease reps"
            disabled={reps <= 1 || busy}
            onClick={() => setReps((value) => Math.max(1, value - 1))}
          >
            −
          </button>
          <p className={styles.editReps}>{reps}</p>
          <button
            type="button"
            aria-label="Increase reps"
            disabled={reps >= 500 || busy}
            onClick={() => setReps((value) => Math.min(500, value + 1))}
          >
            +
          </button>
        </div>
        <input
          className={styles.noteInput}
          value={note}
          maxLength={500}
          placeholder="Optional note"
          onChange={(event) => setNote(event.target.value)}
        />
        {error && <p className={styles.error}>{error}</p>}
        <button
          type="button"
          className={styles.saveButton}
          disabled={busy}
          onClick={() =>
            void onSave({
              variationId,
              reps,
              note: note.trim() ? note.trim() : null,
            })
          }
        >
          Save
        </button>
        {confirmDelete ? (
          <button
            type="button"
            className={styles.deleteConfirm}
            disabled={busy}
            onClick={() => void onDelete()}
          >
            Confirm delete
          </button>
        ) : (
          <button
            type="button"
            className={styles.deleteButton}
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Delete set
          </button>
        )}
      </motion.div>
      <VariationSheet
        nested
        open={pickerOpen}
        variations={variations}
        selectedId={variationId || set.variationId}
        onSelect={setVariationId}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
