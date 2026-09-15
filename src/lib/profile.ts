import "server-only";
import { getDb } from "./db";
import { isTheme, type Theme } from "./theme-shared";

export { isTheme, type Theme };

export const DISPLAY_NAME_MAX = 32;
export const BIO_MAX = 160;

export type Profile = {
  userId: string;
  displayName: string | null;
  bio: string | null;
  theme: Theme | null;
};

type Row = { user_id: string; display_name: string | null; bio: string | null; theme: string | null };

export function getProfile(userId: string): Profile {
  const row = getDb().prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId) as Row | undefined;
  return {
    userId,
    displayName: row?.display_name ?? null,
    bio: row?.bio ?? null,
    theme: isTheme(row?.theme) ? row.theme : null,
  };
}

export function getProfiles(userIds: string[]): Map<string, Profile> {
  return new Map(userIds.map((id) => [id, getProfile(id)]));
}

/** Upsert only the fields provided; undefined leaves a column as it was. */
export function updateProfile(
  userId: string,
  patch: { displayName?: string | null; bio?: string | null; theme?: Theme | null },
): Profile {
  const current = getProfile(userId);
  const next = {
    displayName: patch.displayName === undefined ? current.displayName : patch.displayName,
    bio: patch.bio === undefined ? current.bio : patch.bio,
    theme: patch.theme === undefined ? current.theme : patch.theme,
  };
  getDb()
    .prepare(
      `INSERT INTO profiles (user_id, display_name, bio, theme, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name, bio = excluded.bio,
       theme = excluded.theme, updated_at = excluded.updated_at`,
    )
    .run(userId, next.displayName, next.bio, next.theme, new Date().toISOString());
  return { userId, ...next };
}

export function getNotificationsSeenAt(userId: string): Date | null {
  const row = getDb().prepare("SELECT seen_at FROM notification_state WHERE user_id = ?").get(userId) as
    | { seen_at: string }
    | undefined;
  return row ? new Date(row.seen_at) : null;
}

export function markNotificationsSeen(userId: string, at = new Date()): void {
  getDb()
    .prepare(
      "INSERT INTO notification_state (user_id, seen_at) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET seen_at = excluded.seen_at",
    )
    .run(userId, at.toISOString());
}
