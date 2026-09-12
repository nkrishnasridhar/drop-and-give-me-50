/**
 * Typed, fail-fast access to required environment variables.
 *
 * Values are read lazily through getters so importing this module never
 * throws by itself — only accessing a variable that a code path actually
 * needs does. That keeps routes and builds that don't touch the database
 * (e.g. static pages, `tsc --noEmit`) working even when `DATABASE_URL`
 * isn't configured.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value ? value : undefined;
}

export const env = {
  get DATABASE_URL() {
    return requireEnv("DATABASE_URL");
  },
  get VAPID_PUBLIC_KEY() {
    return optionalEnv("VAPID_PUBLIC_KEY");
  },
  get VAPID_PRIVATE_KEY() {
    return optionalEnv("VAPID_PRIVATE_KEY");
  },
  get VAPID_SUBJECT() {
    return optionalEnv("VAPID_SUBJECT");
  },
  get CRON_SECRET() {
    return optionalEnv("CRON_SECRET");
  },
} as const;
