/**
 * Seeds the 22 push-up variations named in docs/prd.md. Idempotent: safe
 * to re-run, since it upserts on the `id` primary key rather than
 * inserting blindly.
 *
 * Run with `npm run db:seed`.
 */
import { config } from "dotenv";
import type { MuscleEmphasis, VariationFamily } from "@/server/db/schema";

// Runs standalone via `tsx`, outside Next.js, so env files aren't loaded
// automatically — same reasoning as drizzle.config.ts. This must happen
// before the `db` import below, since that module reads DATABASE_URL at
// import time.
config({ path: ".env.local" });
config({ path: ".env" });

const { db } = await import("@/server/db/client");
const { variations } = await import("@/server/db/schema");

interface SeedVariation {
  id: string;
  name: string;
  family: VariationFamily;
  intensityFactor: number;
  difficulty: number;
  primaryEmphasis: MuscleEmphasis;
}

// Ordered easiest to hardest by intensityFactor — this becomes the
// default sort order in the variation picker.
const SEED_VARIATIONS: SeedVariation[] = [
  { id: "scap", name: "Scap Push-Up", family: "scapular", intensityFactor: 0.3, difficulty: 1, primaryEmphasis: "serratus" },
  { id: "single-arm-scap", name: "Single Arm Scap Push-Up", family: "scapular", intensityFactor: 0.4, difficulty: 2, primaryEmphasis: "serratus" },
  { id: "countertop", name: "Counter-Top Push-Up", family: "assisted", intensityFactor: 0.45, difficulty: 1, primaryEmphasis: "chest" },
  { id: "block-assisted", name: "Block Assisted Push-Up", family: "assisted", intensityFactor: 0.5, difficulty: 1, primaryEmphasis: "chest" },
  { id: "knee", name: "Knee Push-Up", family: "assisted", intensityFactor: 0.55, difficulty: 1, primaryEmphasis: "chest" },
  { id: "upper-body-only", name: "Upper Body Only Push-Up", family: "standard", intensityFactor: 0.85, difficulty: 2, primaryEmphasis: "chest" },
  { id: "wide", name: "Wide Push-Up", family: "wide", intensityFactor: 0.95, difficulty: 2, primaryEmphasis: "chest" },
  { id: "regular", name: "Regular Push-Up", family: "standard", intensityFactor: 1.0, difficulty: 2, primaryEmphasis: "chest" },
  { id: "tricep", name: "Tricep Push-Up", family: "tricep", intensityFactor: 1.05, difficulty: 2, primaryEmphasis: "triceps" },
  { id: "beginner-explosive", name: "Beginner Explosive Push-Up", family: "dynamic", intensityFactor: 1.1, difficulty: 3, primaryEmphasis: "chest" },
  { id: "close-grip", name: "Close Grip Push-Up", family: "tricep", intensityFactor: 1.1, difficulty: 3, primaryEmphasis: "triceps" },
  { id: "diamond", name: "Diamond Push-Up", family: "tricep", intensityFactor: 1.15, difficulty: 3, primaryEmphasis: "triceps" },
  { id: "pike", name: "Pike Push-Up", family: "shoulder", intensityFactor: 1.2, difficulty: 3, primaryEmphasis: "shoulders" },
  { id: "decline", name: "Decline Push-Up", family: "standard", intensityFactor: 1.2, difficulty: 3, primaryEmphasis: "shoulders" },
  { id: "extended-rom", name: "Extended ROM Push-Up", family: "standard", intensityFactor: 1.25, difficulty: 3, primaryEmphasis: "chest" },
  { id: "cross-hand", name: "Cross Hand Push-Up", family: "unilateral", intensityFactor: 1.25, difficulty: 3, primaryEmphasis: "core" },
  { id: "russian", name: "Russian Push-Up", family: "shoulder", intensityFactor: 1.3, difficulty: 4, primaryEmphasis: "shoulders" },
  { id: "archer", name: "Archer Push-Up", family: "unilateral", intensityFactor: 1.5, difficulty: 4, primaryEmphasis: "chest" },
  { id: "walking-lizard", name: "Walking Lizard Push-Up", family: "dynamic", intensityFactor: 1.6, difficulty: 4, primaryEmphasis: "core" },
  { id: "pseudo", name: "Pseudo Push-Up", family: "shoulder", intensityFactor: 1.6, difficulty: 4, primaryEmphasis: "shoulders" },
  { id: "clapping", name: "Clapping Push-Up", family: "dynamic", intensityFactor: 1.7, difficulty: 4, primaryEmphasis: "chest" },
  { id: "handstand", name: "Handstand Push-Up", family: "advanced", intensityFactor: 2.2, difficulty: 5, primaryEmphasis: "shoulders" },
];

async function main() {
  for (const [index, variation] of SEED_VARIATIONS.entries()) {
    await db
      .insert(variations)
      .values({ ...variation, sortOrder: index + 1, isActive: true })
      .onConflictDoUpdate({
        target: variations.id,
        set: {
          name: variation.name,
          sortOrder: index + 1,
          family: variation.family,
          intensityFactor: variation.intensityFactor,
          difficulty: variation.difficulty,
          primaryEmphasis: variation.primaryEmphasis,
          isActive: true,
        },
      });
  }

  console.log(`Seeded ${SEED_VARIATIONS.length} push-up variations.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
