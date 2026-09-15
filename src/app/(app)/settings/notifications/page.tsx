import Link from "next/link";
import { MarkSeen } from "@/components/MarkSeen";
import { cardImage } from "@/lib/images";
import { episodeCode } from "@/lib/format";
import { buildNotifications } from "@/lib/notifications";
import { requireMember } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function NotificationsPage() {
  const session = await requireMember();
  const feed = await buildNotifications(session);
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="label text-text">What&apos;s new</p>
          <p className="label mt-1 text-[0.62rem] text-dim">
            New titles in the library and new episodes of series you watch.
          </p>
        </div>
        <span className="label text-muted">{feed.unread} unread</span>
      </div>
      <MarkSeen unread={feed.unread} />
      {feed.items.length === 0 ? (
        <p className="label border border-dashed border-line px-6 py-10 text-center text-dim">Nothing new yet.</p>
      ) : (
        <ul className="border-t border-line">
          {feed.items.map((n) => {
            const image = cardImage(n.item, 240);
            const href = n.item.Type === "Episode" ? `/watch/${n.item.Id}` : `/item/${n.item.Id}`;
            const title = n.item.Type === "Episode" ? n.item.SeriesName ?? n.item.Name : n.item.Name;
            const detail =
              n.kind === "episode"
                ? `New episode · ${episodeCode(n.item.ParentIndexNumber, n.item.IndexNumber)} · ${n.item.Name}`
                : `Added to the library${n.item.ProductionYear ? ` · ${n.item.ProductionYear}` : ""}`;
            return (
              <li key={n.id} className="border-b border-line">
                <Link href={href} className="grid grid-cols-[96px_1fr_auto] items-center gap-4 py-3 hover:bg-panel-2">
                  <div className="aspect-video overflow-hidden border border-line bg-panel">
                    {image && (
                      // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
                      <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="label flex items-center gap-2 truncate text-text">
                      {n.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="unread" />}
                      {title}
                    </p>
                    <p className="label mt-1 truncate text-[0.62rem] text-muted">{detail}</p>
                  </div>
                  <span className="label pr-3 text-[0.62rem] text-dim">{when(n.at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
