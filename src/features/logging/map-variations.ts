import type { VariationOption } from "@/features/logging/types";

export function asVariationOptions(
  rows: readonly {
    id: string;
    name: string;
    family: string;
    intensityFactor: number;
    difficulty: number;
    primaryEmphasis: string;
    sortOrder: number;
  }[],
): VariationOption[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    family: row.family,
    intensityFactor: row.intensityFactor,
    difficulty: row.difficulty,
    primaryEmphasis: row.primaryEmphasis,
    sortOrder: row.sortOrder,
  }));
}
