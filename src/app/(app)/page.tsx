import type { ClientSetSource } from "@/domain/set";
import { LogScreen } from "@/features/logging/log-screen";
import { asVariationOptions } from "@/features/logging/map-variations";
import { createCaller } from "@/server/api/root";
import { auth } from "@/server/auth";

function parseArmedReps(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) return undefined;
  return parsed;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;
  const armedReps = parseArmedReps(
    typeof params.reps === "string" ? params.reps : undefined,
  );
  const source: ClientSetSource =
    params.source === "shortcut" ? "shortcut" : "app";

  const caller = await createCaller();
  const variationList = asVariationOptions(await caller.variations.list());

  return (
    <LogScreen
      variations={variationList}
      armedReps={armedReps}
      source={source}
    />
  );
}
