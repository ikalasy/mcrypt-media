import Link from "next/link";
import { notFound } from "next/navigation";
import { heroMeta } from "@/components/Hero";
import { Empty, Row, RowHeader, SectionHeader } from "@/components/Headers";
import { MediaCard } from "@/components/MediaCard";
import { backdropImage, cardImage, posterImage } from "@/lib/images";
import { episodeCode, formatClock, formatRuntime, playedPercent, ticksToSeconds } from "@/lib/format";
import { getEpisodes, getItem, getNextUp, getSeasons, getSimilar } from "@/lib/jellyfin";
import { requireSession, type Session } from "@/lib/session";
import type { BaseItem, ItemsResult } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<{ season?: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const session = await requireSession();
  const { id } = await params;
  const item = await getItem(session, id).catch(() => null);
  return { title: item?.Name ?? "Not found" };
}

function resumeLabel(item: BaseItem): string {
  const position = item.UserData?.PlaybackPositionTicks;
  return position ? `Resume ${formatClock(ticksToSeconds(position))}` : "Play";
}

async function seriesData(session: Session, series: BaseItem, seasonParam?: string) {
  const seasons = await getSeasons(session, series.Id).catch(() => ({ Items: [] as BaseItem[] }));
  const selected = seasons.Items.find((s) => s.Id === seasonParam) ?? seasons.Items[0];
  const [episodes, nextUp] = await Promise.all([
    selected ? getEpisodes(session, series.Id, selected.Id) : Promise.resolve({ Items: [] as BaseItem[] } as ItemsResult),
    getNextUp(session, 1).catch(() => ({ Items: [] as BaseItem[] })),
  ]);
  const next = nextUp.Items.find((e) => e.SeriesId === series.Id) ?? episodes.Items.find((e) => !e.UserData?.Played) ?? episodes.Items[0];
  return { seasons: seasons.Items, selected, episodes: episodes.Items, next };
}

function EpisodeRow({ episode }: { episode: BaseItem }) {
  const image = cardImage(episode, 320);
  const percent = playedPercent(episode.UserData?.PlaybackPositionTicks, episode.RunTimeTicks);
  return (
    <Link href={`/watch/${episode.Id}`} className="group grid grid-cols-[140px_1fr] gap-5 border-b border-line py-4 sm:grid-cols-[200px_1fr]">
      <div className="relative aspect-video overflow-hidden border border-line bg-panel">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="art-empty h-full w-full" />
        )}
        {percent > 0 && (
          <div className="progress absolute inset-x-0 bottom-0">
            <span style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="label flex flex-wrap items-center gap-3 text-text group-hover:text-accent">
          <span className="text-muted">{episodeCode(episode.ParentIndexNumber, episode.IndexNumber)}</span>
          <span className="truncate">{episode.Name}</span>
          {episode.UserData?.Played && <span className="text-[0.6rem] text-dim">Watched</span>}
        </p>
        <p className="label mt-1 text-[0.62rem] text-muted">{formatRuntime(episode.RunTimeTicks)}</p>
        {episode.Overview && <p className="mt-2 line-clamp-2 text-[0.75rem] leading-relaxed text-muted">{episode.Overview}</p>}
      </div>
    </Link>
  );
}

export default async function ItemPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const session = await requireSession();
  const { id } = await params;
  const { season } = await searchParams;
  const item = await getItem(session, id).catch(() => null);
  if (!item) notFound();

  const isSeries = item.Type === "Series";
  const isPlayable = item.Type === "Movie" || item.Type === "Episode";
  const [series, similar] = await Promise.all([
    isSeries ? seriesData(session, item, season) : Promise.resolve(null),
    getSimilar(session, item.Id).catch(() => ({ Items: [] as BaseItem[] })),
  ]);

  const backdrop = backdropImage(item, 1920);
  const poster = posterImage(item, 360);
  const cast = (item.People ?? []).filter((p) => p.Type === "Actor").slice(0, 8);
  const directors = (item.People ?? []).filter((p) => p.Type === "Director").map((p) => p.Name);
  const playHref = isPlayable ? `/watch/${item.Id}` : series?.next ? `/watch/${series.next.Id}` : null;

  return (
    <div className="space-y-12">
      <section className="relative -mx-6 -mt-8 overflow-hidden border-b border-line sm:-mx-10">
        {backdrop && (
          // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
          <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" loading="eager" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/20" />
        <div className="relative mx-auto grid max-w-[1700px] gap-8 px-6 pb-10 pt-16 sm:px-10 md:grid-cols-[220px_1fr]">
          <div className="hidden aspect-[2/3] overflow-hidden border border-line bg-panel md:block">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
              <img src={poster} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="art-empty h-full w-full" />
            )}
          </div>
          <div className="flex flex-col justify-end">
            {item.SeriesName && (
              <Link href={`/item/${item.SeriesId}`} className="label text-muted hover:text-accent">{item.SeriesName}</Link>
            )}
            <h1 className="mt-2 text-3xl font-medium uppercase leading-tight tracking-[0.12em] sm:text-4xl xl:text-5xl">{item.Name}</h1>
            <p className="label mt-5 text-muted">
              {[...heroMeta(item), item.OfficialRating, item.CommunityRating ? `${item.CommunityRating.toFixed(1)} ★` : ""]
                .filter(Boolean)
                .join("  /  ")}
            </p>
            {item.Taglines?.[0] && <p className="label mt-4 text-dim">{item.Taglines[0]}</p>}
            {item.Overview && <p className="mt-5 max-w-[70ch] text-[0.8rem] leading-relaxed text-muted">{item.Overview}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {playHref && (
                <Link href={playHref} className="btn btn-solid">
                  <span aria-hidden>&#9654;</span>
                  {isSeries && series?.next
                    ? `Play ${episodeCode(series.next.ParentIndexNumber, series.next.IndexNumber)}`
                    : resumeLabel(item)}
                </Link>
              )}
              {directors.length > 0 && <span className="label text-muted">Dir. {directors.join(", ")}</span>}
            </div>
          </div>
        </div>
      </section>

      {isSeries && series && (
        <section className="space-y-6">
          <SectionHeader title="Episodes" />
          {series.seasons.length > 0 && (
            <div className="row-scroll flex gap-2 overflow-x-auto">
              {series.seasons.map((s) => (
                <Link
                  key={s.Id}
                  href={`/item/${item.Id}?season=${s.Id}`}
                  className={`label whitespace-nowrap border px-3 py-1.5 ${s.Id === series.selected?.Id ? "border-accent text-text" : "border-line text-muted hover:text-text"}`}
                >
                  {s.Name}
                </Link>
              ))}
            </div>
          )}
          {series.episodes.length ? (
            <div>{series.episodes.map((e) => <EpisodeRow key={e.Id} episode={e} />)}</div>
          ) : (
            <Empty>No episodes in this season.</Empty>
          )}
        </section>
      )}

      {cast.length > 0 && (
        <section>
          <RowHeader title="Cast" />
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {cast.map((p) => (
              <p key={p.Id} className="label">
                <span className="text-text">{p.Name}</span>
                {p.Role && <span className="text-dim"> &middot; {p.Role}</span>}
              </p>
            ))}
          </div>
        </section>
      )}

      {similar.Items.length > 0 && (
        <section>
          <RowHeader title="More like this" />
          <Row>
            {similar.Items.map((s) => (
              <MediaCard key={s.Id} item={s} width={236} />
            ))}
          </Row>
        </section>
      )}
    </div>
  );
}
