import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getEnv } from "./env";

export const SESSION_COOKIE = "mc_session";
const SESSION_DAYS = 30;
const IV_BYTES = 12;

export type Session = {
  token: string;
  userId: string;
  userName: string;
  isAdmin: boolean;
  /** Shared, auto-provisioned public account. Browse and limited playback only. */
  isGuest?: boolean;
  /** Random per-browser id for guests, so stream reports are tied to the visitor who started them. */
  visitorId?: string;
  deviceId: string;
  /** Jellyseerr `connect.sid` cookie value, when the Jellyseerr login succeeded. */
  jellyseerrCookie?: string;
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function deriveKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/** Copies into a fresh ArrayBuffer so WebCrypto accepts it as a BufferSource. */
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(Buffer.from(text, "base64url"));
}

/** AES-GCM encrypt arbitrary text with the session secret (also used for stored guest credentials). */
export async function encryptText(text: string): Promise<string> {
  const key = await deriveKey(getEnv().sessionSecret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text)),
  );
  return `${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

export async function decryptText(sealed: string): Promise<string | null> {
  const [ivPart, dataPart] = sealed.split(".");
  if (!ivPart || !dataPart) return null;
  try {
    const key = await deriveKey(getEnv().sessionSecret);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivPart) },
      key,
      fromBase64Url(dataPart),
    );
    return decoder.decode(plaintext);
  } catch {
    return null;
  }
}

export function sealSession(session: Session): Promise<string> {
  return encryptText(JSON.stringify(session));
}

export async function openSession(sealed: string): Promise<Session | null> {
  const text = await decryptText(sealed);
  if (!text) return null;
  try {
    const session = JSON.parse(text) as Session;
    if (typeof session.token !== "string" || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function newSessionExpiry(): number {
  return Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getEnv().cookieSecure,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

/** Read the current session from the request cookies, or null when logged out. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = await openSession(raw);
  if (!session?.isGuest) return session;
  // Guests share one Jellyfin token that may have been rotated since the cookie was issued.
  const { getGuestToken } = await import("./guest-token");
  const token = await getGuestToken();
  return token ? { ...session, token } : null;
}

/** Like getSession, but redirects to /login when there is no valid session. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** A signed-in, non-guest user. Guests are sent to the login page to get a real account. */
export async function requireMember(): Promise<Session> {
  const session = await requireSession();
  if (session.isGuest) redirect("/login?reason=member");
  return session;
}

/** Admins only; everyone else gets a 404 so the page's existence is not advertised. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.isAdmin || session.isGuest) notFound();
  return session;
}
