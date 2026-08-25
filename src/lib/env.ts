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

export const env = {
  get DATABASE_URL() {
    return requireEnv("DATABASE_URL");
  },
} as const;
