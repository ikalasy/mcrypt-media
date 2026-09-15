import "server-only";
import { getSetting, setSetting } from "./db";
import { authenticate } from "./jellyfin";
import { decryptText, encryptText } from "./session";

/**
 * All guest visitors share ONE Jellyfin session. Signing each visitor in
 * separately would hit the guest account's one-session limit, so the token is
 * authenticated once, cached in memory and SQLite, and reused until Jellyfin
 * rejects it.
 */

export const GUEST_USERNAME = "guest";
export const GUEST_DEVICE_ID = "movie-crypted-guest";
const CREDENTIALS_KEY = "guest_credentials";
const TOKEN_KEY = "guest_token";

export type GuestCredentials = { userId: string; password: string; provisionedAt: string };

let memoryToken: string | null = null;
let pending: Promise<string | null> | null = null;

export async function readGuestCredentials(): Promise<GuestCredentials | null> {
  const sealed = getSetting(CREDENTIALS_KEY);
  if (!sealed) return null;
  const text = await decryptText(sealed);
  if (!text) return null;
  try {
    return JSON.parse(text) as GuestCredentials;
  } catch {
    return null;
  }
}

export async function writeGuestCredentials(credentials: GuestCredentials): Promise<void> {
  setSetting(CREDENTIALS_KEY, await encryptText(JSON.stringify(credentials)));
  invalidateGuestToken();
}

async function authenticateGuest(): Promise<string | null> {
  const credentials = await readGuestCredentials();
  if (!credentials) return null;
  try {
    const auth = await authenticate(GUEST_USERNAME, credentials.password, GUEST_DEVICE_ID);
    memoryToken = auth.AccessToken;
    setSetting(TOKEN_KEY, await encryptText(auth.AccessToken));
    return memoryToken;
  } catch (error) {
    console.error("[guest] Jellyfin sign-in for the guest account failed:", error);
    return null;
  }
}

/** Current shared guest token, signing in when there is none cached. Null when not provisioned. */
export async function getGuestToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  const sealed = getSetting(TOKEN_KEY);
  if (sealed) {
    const token = await decryptText(sealed);
    if (token) {
      memoryToken = token;
      return token;
    }
  }
  if (!pending) {
    pending = authenticateGuest().finally(() => {
      pending = null;
    });
  }
  return pending;
}

/** Drop the cached token (Jellyfin rejected it, or the password was rotated). */
export function invalidateGuestToken(): void {
  memoryToken = null;
  setSetting(TOKEN_KEY, "");
}
