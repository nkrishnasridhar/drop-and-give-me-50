export interface VariationOption {
  id: string;
  name: string;
  family: string;
  intensityFactor: number;
  difficulty: number;
  primaryEmphasis: string;
  sortOrder: number;
}

export const FAMILY_ORDER = [
  "scapular",
  "assisted",
  "standard",
  "tricep",
  "wide",
  "dynamic",
  "shoulder",
  "unilateral",
  "advanced",
] as const;

export const FAMILY_LABELS: Record<(typeof FAMILY_ORDER)[number], string> = {
  scapular: "Scapular",
  assisted: "Assisted",
  standard: "Standard",
  tricep: "Tricep",
  wide: "Wide",
  dynamic: "Dynamic",
  shoulder: "Shoulder",
  unilateral: "Unilateral",
  advanced: "Advanced",
};
