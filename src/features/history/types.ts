export interface HistorySet {
  id: string;
  variationId: string;
  variationName: string;
  reps: number;
  occurredAt: string;
  localDate: string;
  note: string | null;
  intensityFactor: number;
}
