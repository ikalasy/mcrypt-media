/** Server-only environment access. Validated lazily so `next build` works without secrets. */

const trimSlash = (value: string) => value.replace(/\/+$/, "");

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value;
}

export const APP_NAME = "Movie Crypted";
export const APP_VERSION = "0.1.1";

const MIN_SECRET_LENGTH = 32;

function sessionSecret(): string {
  const value = required("SESSION_SECRET");
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return value;
}

export function getEnv() {
  return {
    jellyfinUrl: trimSlash(required("JELLYFIN_URL")),
    jellyseerrUrl: trimSlash(process.env.JELLYSEERR_URL ?? ""),
    jellyfinApiKey: process.env.JELLYFIN_API_KEY ?? "",
    jellyseerrApiKey: process.env.JELLYSEERR_API_KEY ?? "",
    sessionSecret: sessionSecret(),
    contactEmail: (process.env.CONTACT_EMAIL ?? "").trim(),
    cookieSecure:
      process.env.COOKIE_SECURE !== undefined
        ? process.env.COOKIE_SECURE === "true"
        : process.env.NODE_ENV === "production",
  } as const;
}
