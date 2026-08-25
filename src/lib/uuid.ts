/**
 * UUIDv7 generation (RFC 9562), implemented directly rather than pulled in
 * as a dependency.
 *
 * Per docs/decisions.md #2, every `push_sets.id` is generated on the
 * client as a UUIDv7 — this is what makes offline retry safe, since the
 * same write can be resubmitted indefinitely under the same ID. UUIDv7
 * specifically (over v4) also sorts chronologically, which is a genuinely
 * useful property for a log-shaped table, not just an arbitrary choice.
 * `crypto.randomUUID()` only produces v4, so there is no built-in
 * alternative — and the format is a short, fully-specified layout, so
 * hand-rolling it is less risk than it looks:
 *
 *   48 bits  unix_ts_ms       (big-endian milliseconds since epoch)
 *    4 bits  version          (0111 = 7)
 *   12 bits  rand_a
 *    2 bits  variant          (10)
 *   62 bits  rand_b
 */
export function generateUuidV7(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const timestamp = Date.now();
  bytes[0] = (timestamp / 2 ** 40) & 0xff;
  bytes[1] = (timestamp / 2 ** 32) & 0xff;
  bytes[2] = (timestamp / 2 ** 24) & 0xff;
  bytes[3] = (timestamp / 2 ** 16) & 0xff;
  bytes[4] = (timestamp / 2 ** 8) & 0xff;
  bytes[5] = timestamp & 0xff;

  bytes[6] = 0x70 | (bytes[6] & 0x0f); // version 7
  bytes[8] = 0x80 | (bytes[8] & 0x3f); // variant 10xxxxxx

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
