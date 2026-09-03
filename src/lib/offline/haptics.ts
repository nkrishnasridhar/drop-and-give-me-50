/**
 * Android Chrome honours this; iOS Safari does not. Failure is silent
 * on purpose — a missing buzz must never block a log
 * (docs/architecture.md §1).
 */
export function confirmHaptic(): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  navigator.vibrate(18);
}
