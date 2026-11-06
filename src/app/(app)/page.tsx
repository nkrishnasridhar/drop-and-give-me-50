import { Suspense } from "react";
import { LogScreen } from "@/features/logging/log-screen";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <LogScreen />
    </Suspense>
  );
}
