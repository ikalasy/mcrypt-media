import "server-only";
import { getItems, getLatest, getResume, getNextUp } from "./jellyfin";
import { getNotificationsSeenAt } from "./profile";
import type { Session } from "./session";
import type { BaseItem } from "./types";

/**
 * "What's new for you": titles added to the library and new episodes of series
 * you are watching, since you last opened Notifications (or the last 14 days
 * the first time).
 */

const DEFAULT_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 60;
const MS_PER_DAY = 86_400_000;

export type Notification = {
  id: string;
  kind: "added" | "episode";
  item: BaseItem;
  at: string;
  unread: boolean;
};

export type NotificationFeed = { items: Notification[]; unread: number; since: string };

function addedAt(item: BaseItem): number {
  return item.DateCreated ? Date.parse(item.DateCreated) : 0;
}

/** Series the user has touched: in progress, next up, or previously played. */
async function watchedSeriesIds(session: Session): Promise<Set<string>> {
  const [resume, nextUp, played] = await Promise.all([
    getResume(session, 50).catch(() => ({ Items: [] as BaseItem[] })),
    getNextUp(session, 50).catch(() => ({ Items: [] as BaseItem[] })),
    getItems(session, { types: "Series", filters: "IsPlayed", limit: 100 }).catch(() => ({ Items: [] as BaseItem[] })),
  ]);
  const ids = new Set<string>();
  for (const item of [...resume.Items, ...nextUp.Items]) if (item.SeriesId) ids.add(item.SeriesId);
  for (const series of played.Items) ids.add(series.Id);
  return ids;
}

const BADGE_TTL_MS = 60_000;
const BADGE_SAMPLE = 30;
const badgeCache = new Map<string, { at: number; value: number }>();

/**
 * Unread count for the header badge: one Jellyfin call, cached per user for a
 * minute. The full feed (with episodes) is only built on the Notifications page.
 */
export async function countUnreadForBadge(session: Session): Promise<number> {
  const seenAt = getNotificationsSeenAt(session.userId);
  const key = `${session.userId}:${seenAt?.getTime() ?? 0}`;
  const cached = badgeCache.get(key);
  if (cached && Date.now() - cached.at < BADGE_TTL_MS) return cached.value;
  const latest = await getLatest(session, BADGE_SAMPLE).catch(() => [] as BaseItem[]);
  const cutoff = seenAt?.getTime() ?? Date.now() - DEFAULT_WINDOW_DAYS * MS_PER_DAY;
  const value = latest.filter((item) => addedAt(item) > cutoff).length;
  badgeCache.set(key, { at: Date.now(), value });
  return value;
}

export async function buildNotifications(session: Session): Promise<NotificationFeed> {
  const seenAt = getNotificationsSeenAt(session.userId);
  // First visit shows two weeks; after that the feed reaches back further so read items stay visible.
  const since = new Date(Date.now() - (seenAt ? MAX_WINDOW_DAYS : DEFAULT_WINDOW_DAYS) * MS_PER_DAY);

  const [latest, episodes, watched] = await Promise.all([
    getLatest(session, 40).catch(() => [] as BaseItem[]),
    getItems(session, {
      types: "Episode",
      sortBy: "DateCreated",
      sortOrder: "Descending",
      limit: 200,
    }).catch(() => ({ Items: [] as BaseItem[] })),
    watchedSeriesIds(session),
  ]);

  const unreadCutoff = seenAt?.getTime() ?? 0;
  const added: Notification[] = latest
    .filter((item) => addedAt(item) >= since.getTime())
    .map((item) => ({
      id: `added-${item.Id}`,
      kind: "added" as const,
      item,
      at: item.DateCreated ?? "",
      unread: addedAt(item) > unreadCutoff,
    }));

  const newEpisodes: Notification[] = episodes.Items.filter(
    (ep) => ep.SeriesId && watched.has(ep.SeriesId) && addedAt(ep) >= since.getTime(),
  ).map((ep) => ({
    id: `episode-${ep.Id}`,
    kind: "episode" as const,
    item: ep,
    at: ep.DateCreated ?? "",
    unread: addedAt(ep) > unreadCutoff,
  }));

  const items = [...added, ...newEpisodes].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { items, unread: items.filter((n) => n.unread).length, since: since.toISOString() };
}
