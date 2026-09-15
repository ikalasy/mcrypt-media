import "server-only";

/**
 * Guests share one Jellyfin session, so Jellyfin cannot count their streams.
 * The proxy registers every guest playback here, keyed by Jellyfin's
 * PlaySessionId and owned by the visitor (cookie) that started it. Reports
 * from any other visitor are ignored, so one guest cannot free the slot by
 * naming another guest's stream. A visitor starting a new stream replaces
 * their own previous one, so switching titles never self-blocks.
 */

const STALE_AFTER_MS = 60_000;

type Entry = { owner: string; lastSeen: number };
const active = new Map<string, Entry>();

function prune(now: number): void {
  for (const [id, entry] of active) {
    if (now - entry.lastSeen > STALE_AFTER_MS) active.delete(id);
  }
}

export function activeGuestStreams(now = Date.now()): number {
  prune(now);
  return active.size;
}

/** True when this visitor may start the given play session: the slot is free or already theirs. */
export function canStartGuestStream(playSessionId: string, owner: string, now = Date.now()): boolean {
  prune(now);
  const existing = active.get(playSessionId);
  if (existing) return existing.owner === owner;
  return [...active.values()].every((entry) => entry.owner === owner);
}

/** Register the stream, dropping any older streams of the same visitor. */
export function startGuestStream(playSessionId: string, owner: string, now = Date.now()): void {
  for (const [id, entry] of active) {
    if (entry.owner === owner && id !== playSessionId) active.delete(id);
  }
  active.set(playSessionId, { owner, lastSeen: now });
}

/** Refresh the entry; ignored unless the caller owns it. */
export function touchGuestStream(playSessionId: string, owner: string, now = Date.now()): void {
  const entry = active.get(playSessionId);
  if (entry && entry.owner === owner) active.set(playSessionId, { owner, lastSeen: now });
}

/** Remove the entry; ignored unless the caller owns it. */
export function endGuestStream(playSessionId: string, owner: string): void {
  const entry = active.get(playSessionId);
  if (entry && entry.owner === owner) active.delete(playSessionId);
}

/** Whether the caller owns this play session (for cancelling its transcode). */
export function ownsGuestStream(playSessionId: string, owner: string): boolean {
  return active.get(playSessionId)?.owner === owner;
}
