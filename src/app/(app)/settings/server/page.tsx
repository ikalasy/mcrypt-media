import Link from "next/link";
import { Empty, RowHeader, SectionHeader } from "@/components/Headers";
import { APP_VERSION } from "@/lib/env";
import { formatBytes, formatClock, formatCount, formatUptime, ticksToSeconds } from "@/lib/format";
import { GuestPanel } from "@/components/GuestPanel";
import { JellyfinThemePanel } from "@/components/JellyfinThemePanel";
import { getEnv } from "@/lib/env";
import { getBranding, isThemeApplied } from "@/lib/jellyfin-branding";
import { guestInfo } from "@/lib/guest";
import { activeGuestStreams } from "@/lib/guest-streams";
import { buildStreamHistory, type StreamHistory } from "@/lib/history";
import { isJellyseerrConfigured, summarizeAllRequests, tmdbImage } from "@/lib/jellyseerr";
import { requireAdmin } from "@/lib/session";
import { buildStatus } from "@/lib/status";
import type { SessionInfo } from "@/lib/types";

const HISTORY_TITLES_PER_CELL = 4;

/** Days down, users across, plays in the cells. */
function HistoryTable({ history }: { history: StreamHistory }) {
  if (history.users.length === 0) {
    return <Empty>No streams recorded in the last 30 days.</Empty>;
  }
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-panel">
            <th className="label px-4 py-3 font-normal text-muted">Day</th>
            {history.users.map((user) => (
              <th key={user.id} className="label px-4 py-3 font-normal text-text">
                {user.name} <span className="text-dim">{user.total}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.days.map((day) => (
            <tr key={day.date} className="border-b border-line align-top last:border-b-0">
              <td className="label whitespace-nowrap px-4 py-3 text-muted">{day.label}</td>
              {history.users.map((user) => {
                const plays = day.byUser[user.id] ?? [];
                return (
                  <td key={user.id} className="max-w-[240px] px-4 py-3">
                    {plays.length ? (
                      <div className="space-y-1">
                        <p className="label text-text">
                          {plays.length} {plays.length === 1 ? "stream" : "streams"}
                        </p>
                        {plays.slice(0, HISTORY_TITLES_PER_CELL).map((play, index) => (
                          <p key={`${play.at}-${index}`} className="label truncate text-[0.62rem] text-muted" title={play.title}>
                            {play.itemId ? (
                              <Link href={`/item/${play.itemId}`} className="hover:text-accent">{play.title}</Link>
                            ) : (
                              play.title
                            )}
                          </p>
                        ))}
                        {plays.length > HISTORY_TITLES_PER_CELL && (
                          <p className="label text-[0.62rem] text-dim" title={plays.slice(HISTORY_TITLES_PER_CELL).map((p) => p.title).join("\n")}>
                            +{plays.length - HISTORY_TITLES_PER_CELL} more
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-dim">&middot;</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Server" };

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-line bg-panel p-5">
      <p className="text-2xl tracking-[0.08em]">{value}</p>
      <p className="label mt-2 text-muted">{label}</p>
    </div>
  );
}

function streamLine(stream: SessionInfo): string {
  const item = stream.NowPlayingItem;
  const name = item?.SeriesName ? `${item.SeriesName} · ${item.Name}` : item?.Name ?? "Unknown";
  return name;
}

function streamMeta(stream: SessionInfo): string {
  const position = formatClock(ticksToSeconds(stream.PlayState?.PositionTicks));
  const runtime = formatClock(ticksToSeconds(stream.NowPlayingItem?.RunTimeTicks));
  const method = stream.PlayState?.PlayMethod ?? "";
  const transcode = stream.TranscodingInfo
    ? `${stream.TranscodingInfo.VideoCodec ?? ""}/${stream.TranscodingInfo.AudioCodec ?? ""}`.toUpperCase()
    : "";
  return [stream.UserName, stream.Client, stream.DeviceName, `${position} / ${runtime}`, method, transcode, stream.PlayState?.IsPaused ? "PAUSED" : ""]
    .filter(Boolean)
    .join("  /  ");
}

export default async function ServerSettingsPage() {
  const session = await requireAdmin();
  const [status, history, requests, guest] = await Promise.all([
    buildStatus(session),
    buildStreamHistory(session),
    isJellyseerrConfigured() ? summarizeAllRequests().catch(() => null) : Promise.resolve(null),
    guestInfo().catch(() => null),
  ]);
  const themeApplied = await getBranding().then(isThemeApplied).catch(() => false);
  const total = status.storage ? status.storage.used + status.storage.free : 0;

  return (
    <div className="space-y-12">
      <SectionHeader
        title="Server"
        aside={
          <span className="label flex items-center gap-2 text-muted">
            <span className={`inline-block h-2 w-2 rounded-full ${status.online ? "bg-ok" : "bg-accent"}`} aria-hidden />
            {status.online ? "Online" : "Offline"}
          </span>
        }
      />

      <section>
        <RowHeader title="Library" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat value={formatCount(status.titles.movies)} label="Movies" />
          <Stat value={formatCount(status.titles.series)} label="Series" />
          <Stat value={formatCount(status.titles.episodes)} label="Episodes" />
          <Stat value={formatCount(status.titles.boxSets)} label="Box sets" />
        </div>
      </section>

      <section>
        <RowHeader title="Storage" />
        {status.storage ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Stat value={formatBytes(status.storage.used)} label="Used" />
              <Stat value={status.storage.free ? formatBytes(status.storage.free) : "—"} label="Free" />
              <Stat
                value={status.storage.free && total ? `${Math.round((status.storage.used / total) * 100)}%` : "—"}
                label="Full"
              />
            </div>
            <div className="border-t border-line">
              {status.storage.libraries.map((lib) => {
                const libTotal = lib.used + lib.free;
                const percent = libTotal ? (lib.used / libTotal) * 100 : 0;
                return (
                  <div key={`${lib.library}-${lib.path}`} className="grid gap-2 border-b border-line py-3 md:grid-cols-[1fr_200px_160px] md:items-center">
                    <p className="label truncate text-text">
                      {lib.library} <span className="text-dim">{lib.path}</span>
                    </p>
                    <div className="progress">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <p className="label text-[0.62rem] text-muted md:text-right">
                      {formatBytes(lib.used)} / {formatBytes(libTotal)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <Empty>Storage details need an admin account or a JELLYFIN_API_KEY on the server.</Empty>
        )}
      </section>

      <section>
        <RowHeader title="Active streams" count={status.streams.length} />
        {status.streams.length ? (
          <div className="border-t border-line">
            {status.streams.map((stream) => (
              <div key={stream.Id} className="border-b border-line py-3">
                <p className="label text-text">
                  {stream.NowPlayingItem ? (
                    <Link href={`/item/${stream.NowPlayingItem.SeriesId ?? stream.NowPlayingItem.Id}`} className="hover:text-accent">
                      {streamLine(stream)}
                    </Link>
                  ) : (
                    streamLine(stream)
                  )}
                </p>
                <p className="label mt-1 text-[0.62rem] text-muted">{streamMeta(stream)}</p>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Nothing playing right now.</Empty>
        )}
      </section>

      <section>
        <RowHeader title="Stream history" count={history.total} />
        <p className="label mb-4 text-[0.62rem] text-dim">Last 30 days, from Jellyfin&apos;s activity log. Days down, users across.</p>
        <HistoryTable history={history} />
      </section>

      <section>
        <RowHeader title="User requests" count={requests?.total} />
        {requests ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat value={formatCount(requests.pending)} label="Pending" />
              <Stat value={formatCount(requests.approved)} label="Approved" />
              <Stat value={formatCount(requests.available)} label="Available" />
              <Stat value={formatCount(requests.declined)} label="Declined" />
            </div>
            {requests.recent.length ? (
              <div className="border-t border-line">
                {requests.recent.map((request) => {
                  const poster = tmdbImage(request.posterPath);
                  return (
                    <div key={request.id} className="grid grid-cols-[40px_1fr_auto] items-center gap-4 border-b border-line py-3">
                      <div className="aspect-[2/3] w-10 overflow-hidden border border-line bg-panel">
                        {poster && (
                          // eslint-disable-next-line @next/next/no-img-element -- TMDB poster
                          <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="label truncate text-text">{request.title}</p>
                        <p className="label mt-1 text-[0.62rem] text-muted">
                          {[request.year, request.type === "tv" ? "Series" : "Movie", request.requestedBy?.displayName ?? request.requestedBy?.jellyfinUsername, new Date(request.createdAt).toLocaleDateString("en-US")]
                            .filter(Boolean)
                            .join("  /  ")}
                        </p>
                      </div>
                      <p className={`label text-[0.62rem] ${request.media.status === 5 ? "text-ok" : request.status === 3 || request.status === 4 ? "text-accent" : request.status === 2 ? "text-warn" : "text-muted"}`}>
                        {request.media.status === 5 ? "Available" : request.status === 2 ? "Approved" : request.status === 3 ? "Declined" : request.status === 4 ? "Failed" : "Pending"}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty>No requests yet.</Empty>
            )}
          </div>
        ) : (
          <Empty>
            {isJellyseerrConfigured()
              ? "Set JELLYSEERR_API_KEY on the server to see every user's requests here."
              : "Requests are not configured. Set JELLYSEERR_URL and JELLYSEERR_API_KEY on the server."}
          </Empty>
        )}
      </section>

      <section>
        <RowHeader title="Guest access" />
        <GuestPanel provisionedAt={guest?.provisionedAt ?? null} activeStreams={activeGuestStreams()} />
      </section>

      <section>
        <RowHeader title="Jellyfin theme" />
        <JellyfinThemePanel applied={themeApplied} jellyfinUrl={getEnv().jellyfinUrl} />
      </section>

      <section>
        <RowHeader title="Server" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat value={status.server?.name ?? "—"} label="Jellyfin" />
          <Stat value={status.server?.version ?? "—"} label="Jellyfin version" />
          <Stat value={status.server?.os ? `${status.server.os} ${status.server.arch ?? ""}`.trim() : "—"} label="Host" />
          <Stat value={`v${APP_VERSION} · ${formatUptime(status.appUptimeMs)}`} label="Movie Crypted" />
        </div>
        {!status.isAdminView && (
          <p className="label mt-4 text-dim">Server details are only shown to admins or when JELLYFIN_API_KEY is set.</p>
        )}
      </section>
    </div>
  );
}
