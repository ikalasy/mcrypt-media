import { notFound } from "next/navigation";
import { Player } from "@/components/Player";
import { episodeCode } from "@/lib/format";
import { getEpisodes, getItem } from "@/lib/jellyfin";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const session = await requireSession();
  const { id } = await params;
  const item = await getItem(session, id).catch(() => null);
  return { title: item ? `Playing ${item.Name}` : "Not found" };
}

export default async function WatchPage({ params }: { params: Params }) {
  const session = await requireSession();
  const { id } = await params;
  const item = await getItem(session, id).catch(() => null);
  if (!item || (item.Type !== "Movie" && item.Type !== "Episode")) notFound();

  let nextHref: string | undefined;
  if (item.Type === "Episode" && item.SeriesId) {
    // All episodes of the series in order, so the last episode of a season rolls into the next one.
    const episodes = await getEpisodes(session, item.SeriesId).catch(() => ({ Items: [] }));
    const index = episodes.Items.findIndex((e) => e.Id === item.Id);
    const next = index >= 0 ? episodes.Items[index + 1] : undefined;
    if (next) nextHref = `/watch/${next.Id}`;
  }

  const isEpisode = item.Type === "Episode";
  return (
    <Player
      itemId={item.Id}
      userId={session.userId}
      deviceId={session.deviceId}
      title={isEpisode ? item.SeriesName ?? item.Name : item.Name}
      subtitle={isEpisode ? `${episodeCode(item.ParentIndexNumber, item.IndexNumber)} · ${item.Name}` : undefined}
      startTicks={item.UserData?.PlaybackPositionTicks ?? 0}
      backHref={isEpisode && item.SeriesId ? `/item/${item.SeriesId}` : `/item/${item.Id}`}
      nextHref={nextHref}
    />
  );
}
