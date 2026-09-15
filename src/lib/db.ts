import "server-only";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Movie Crypted's own store for what Jellyfin has no home for: display names,
 * bios, theme, notification read state, and the provisioned guest account.
 * One SQLite file under DATA_DIR (a Docker volume in production).
 */

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    display_name TEXT,
    bio TEXT,
    theme TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notification_state (
    user_id TEXT PRIMARY KEY,
    seen_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

declare global {
  // Survives Next.js dev hot reloads so we do not open a new handle per reload.
  var __movieCryptedDb: DatabaseSync | undefined;
}

function dataDir(): string {
  return process.env.DATA_DIR || join(process.cwd(), "data");
}

export function getDb(): DatabaseSync {
  if (globalThis.__movieCryptedDb) return globalThis.__movieCryptedDb;
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "movie-crypted.sqlite"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  globalThis.__movieCryptedDb = db;
  return db;
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}
