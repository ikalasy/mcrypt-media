import "server-only";
import { getItemsByIds, getPlaybackActivity, getUsers } from "./jellyfin";
import type { Session } from "./session";
import type { ActivityLogEntry, BaseItem } from "./types";

const HISTORY_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export type HistoryPlay = { title: string; itemId?: string; at: string };

/** Rows are days, columns are users, each cell is the list of plays that user started that day. */
export type StreamHistory = {
  since: string;
  users: { id: string; name: string; total: number }[];
  days: { date: string; label: string; byUser: Record<string, HistoryPlay[]> }[];
  total: number;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function titleFor(item: BaseItem | undefined, entry: ActivityLogEntry): string {
  if (item) return item.SeriesName ? `${item.SeriesName} · ${item.Name}` : item.Name;
  // Fall back to the log line, e.g. "admin is playing The Invite on Web".
  const match = / is playing (.+?)(?: on .+)?$/.exec(entry.Name);
  return match?.[1] ?? entry.Name;
}

export async function buildStreamHistory(session: Session): Promise<StreamHistory> {
  const since = new Date(Date.now() - HISTORY_DAYS * MS_PER_DAY);
  const [entries, users] = await Promise.all([
    getPlaybackActivity(session, since).catch(() => [] as ActivityLogEntry[]),
    getUsers(session).catch(() => []),
  ]);

  const itemIds = [...new Set(entries.map((e) => e.ItemId).filter((id): id is string => Boolean(id)))];
  const items = await getItemsByIds(session, itemIds).catch(() => ({ Items: [] as BaseItem[] }));
  const itemById = new Map(items.Items.map((item) => [item.Id, item]));
  const userName = new Map(users.map((u) => [u.Id, u.Name]));

  const perUser = new Map<string, number>();
  const perDay = new Map<string, Record<string, HistoryPlay[]>>();
  for (const entry of entries) {
    if (!entry.UserId) continue;
    const key = dayKey(entry.Date);
    const day = perDay.get(key) ?? {};
    const plays = day[entry.UserId] ?? [];
    day[entry.UserId] = [
      ...plays,
      { title: titleFor(itemById.get(entry.ItemId ?? ""), entry), itemId: entry.ItemId, at: entry.Date },
    ];
    perDay.set(key, day);
    perUser.set(entry.UserId, (perUser.get(entry.UserId) ?? 0) + 1);
  }

  const columns = [...perUser.entries()]
    .map(([id, total]) => ({ id, name: userName.get(id) ?? id.slice(0, 8), total }))
    .sort((a, b) => b.total - a.total);
  const rows = [...perDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, byUser]) => ({ date, label: dayLabel(date), byUser }));

  return { since: since.toISOString(), users: columns, days: rows, total: entries.length };
}
