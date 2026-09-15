import Link from "next/link";
import { formatBytes, formatCount, formatUptime } from "@/lib/format";
import type { StatusPayload } from "@/lib/status";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl tracking-[0.08em]">{value}</p>
      <p className="label mt-1 text-muted">{label}</p>
    </div>
  );
}

/** Server Stats column from the mockup. Storage needs admin or an API key. */
export function StatsPanel({ status, isAdmin }: { status: StatusPayload; isAdmin: boolean }) {
  const titles = status.titles.movies + status.titles.series;
  return (
    <aside className="vdiv flex flex-col gap-7 pl-8 lg:pl-10">
      {isAdmin ? (
        <Link href="/settings/server" className="label rule pb-3 text-text hover:text-accent">
          Server stats
        </Link>
      ) : (
        <p className="label rule pb-3 text-text">Server stats</p>
      )}
      <Stat value={formatCount(titles)} label="Titles" />
      <Stat
        value={status.storage ? formatBytes(status.storage.used) : "—"}
        label={status.storage ? "Storage used" : "Storage (admin only)"}
      />
      <Stat value={String(status.streams.length)} label={status.streams.length === 1 ? "Stream" : "Streams"} />
      <Stat value={formatUptime(status.appUptimeMs)} label="App uptime" />
    </aside>
  );
}
