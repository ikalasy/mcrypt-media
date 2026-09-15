import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSetting, setSetting } from "./db";
import { jf } from "./jellyfin";
import type { Session } from "./session";

/**
 * Push the MCrypted look into Jellyfin's own web client through its branding
 * config (Dashboard > General > Custom CSS). Whatever CSS was there before is
 * kept in SQLite so Restore puts it back exactly.
 */

const THEME_FILE = join(process.cwd(), "public", "jellyfin-theme.css");
const THEME_MARKER = "MCrypted // Movie Crypted";
const BACKUP_KEY = "jellyfin_custom_css_backup";

export type Branding = { LoginDisclaimer?: string | null; CustomCss?: string | null; SplashscreenEnabled?: boolean };

/** Public endpoint; no auth needed. */
export function getBranding(): Promise<Branding> {
  return jf<Branding>("Branding/Configuration");
}

export function isThemeApplied(branding: Branding): boolean {
  return Boolean(branding.CustomCss?.includes(THEME_MARKER));
}

export function readThemeCss(): Promise<string> {
  return readFile(THEME_FILE, "utf8");
}

async function writeBranding(session: Session, next: Branding): Promise<void> {
  await jf<void>("System/Configuration/Branding", {
    method: "POST",
    token: session.token,
    deviceId: session.deviceId,
    body: {
      LoginDisclaimer: next.LoginDisclaimer ?? "",
      CustomCss: next.CustomCss ?? "",
      SplashscreenEnabled: next.SplashscreenEnabled ?? false,
    },
  });
}

/** Apply the theme, backing up the previous custom CSS the first time. */
export async function applyJellyfinTheme(session: Session): Promise<void> {
  const [current, css] = await Promise.all([getBranding(), readThemeCss()]);
  if (!isThemeApplied(current)) setSetting(BACKUP_KEY, current.CustomCss ?? "");
  await writeBranding(session, { ...current, CustomCss: css });
}

/** Put back whatever was there before the theme (or nothing). */
export async function restoreJellyfinTheme(session: Session): Promise<void> {
  const current = await getBranding();
  await writeBranding(session, { ...current, CustomCss: getSetting(BACKUP_KEY) ?? "" });
}
