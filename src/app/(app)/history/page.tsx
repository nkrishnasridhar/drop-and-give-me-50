import { HistoryScreen } from "@/features/history/history-screen";
import { asVariationOptions } from "@/features/logging/map-variations";
import { createCaller } from "@/server/api/root";
import { auth } from "@/server/auth";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) return null;

  const caller = await createCaller();
  return <HistoryScreen variations={asVariationOptions(await caller.variations.list())} />;
}
