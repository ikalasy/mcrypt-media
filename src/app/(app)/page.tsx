import { heroMeta, trimOverview } from "@/components/Hero";
import { FeaturedRotator, type FeaturedItem } from "@/components/FeaturedRotator";
import { backdropImage } from "@/lib/images";
import { Empty, Row, RowHeader, SectionHeader } from "@/components/Headers";
import { MediaCard } from "@/components/MediaCard";
import { CollectionCard } from "@/components/CollectionCard";
import { StatsPanel } from "@/components/StatsPanel";
import { getGenrePreview, getGenres, getItem, getLatest, getNextUp, getResume } from "@/lib/jellyfin";
import { requireSession } from "@/lib/session";
import { buildStatus } from "@/lib/status";
import type { BaseItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const FEATURED_POOL = 8;
const COLLECTION_PREVIEW = 5;
const CARD_WIDTH = 236;

/** Featured pool: recent additions with a backdrop, rotated in the browser every 95 seconds. */
function pickFeaturedPool(latest: BaseItem[]): BaseItem[] {
  const withArt = latest.filter((i) => i.BackdropImageTags?.length);
  const pool = (withArt.length ? withArt : latest).slice(0, FEATURED_POOL);
  // Start from a different title each day so the first frame is not always the same.
  const offset = pool.length ? Math.floor(Date.now() / 86_400_000) % pool.length : 0;
  return [...pool.slice(offset), ...pool.slice(0, offset)];
}

function toFeatured(item: BaseItem): FeaturedItem {
  return {
    id: item.Id,
    name: item.Name,
    meta: heroMeta(item).join("  /  "),
    overview: trimOverview(item.Overview),
    backdrop: backdropImage(item, 1600),
    playHref: item.Type === "Movie" ? `/watch/${item.Id}` : `/item/${item.Id}`,
    playLabel: item.Type === "Movie" ? "Play" : "Episodes",
  };
}

/** Merge resume items and next-up episodes, resume first, without duplicates. */
function continueWatching(resume: BaseItem[], nextUp: BaseItem[]): BaseItem[] {
  const seen = new Set(resume.map((i) => i.Id));
  return [...resume, ...nextUp.filter((i) => !seen.has(i.Id))];
}

export default async function HomePage() {
  const session = await requireSession();
  const [latest, resume, nextUp, genres, status] = await Promise.all([
    getLatest(session, 16).catch(() => [] as BaseItem[]),
    getResume(session).catch(() => ({ Items: [] as BaseItem[] })),
    getNextUp(session, 8).catch(() => ({ Items: [] as BaseItem[] })),
    getGenres(session).catch(() => ({ Items: [] as BaseItem[] })),
    buildStatus(session),
  ]);

  const watching = session.isGuest ? [] : continueWatching(resume.Items, nextUp.Items);
  const previewGenres = genres.Items.slice(0, COLLECTION_PREVIEW);
  // Second wave, all in parallel: full details for the featured pool and one preview per genre.
  const [featuredPool, previews] = await Promise.all([
    Promise.all(pickFeaturedPool(latest).map((card) => getItem(session, card.Id).catch(() => card))),
    Promise.all(
      previewGenres.map((g) => getGenrePreview(session, g.Id).catch(() => ({ count: undefined, item: undefined }))),
    ),
  ]);
  const featured = featuredPool.map(toFeatured);

  return (
    <div className="space-y-12">
      {featured.length ? (
        <FeaturedRotator items={featured}>
          <StatsPanel status={status} isAdmin={session.isAdmin} />
        </FeaturedRotator>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
          <Empty>Your library is empty. Add media in Jellyfin and it will show up here.</Empty>
          <StatsPanel status={status} isAdmin={session.isAdmin} />
        </div>
      )}

      <section className="space-y-8">
        <SectionHeader title="The Library" />

        <div>
          <RowHeader title="Recently added" href="/library?sort=DateCreated&order=Descending" />
          {latest.length ? (
            <Row>
              {latest.map((item, index) => (
                <MediaCard key={item.Id} item={item} width={CARD_WIDTH} priority={index < 6} />
              ))}
            </Row>
          ) : (
            <Empty>Nothing added yet.</Empty>
          )}
        </div>

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <RowHeader title="Continue watching" href="/library?filter=resume" />
            {watching.length ? (
              <Row>
                {watching.map((item) => (
                  <MediaCard key={item.Id} item={item} width={CARD_WIDTH - 20} progress />
                ))}
              </Row>
            ) : (
              <Empty>{session.isGuest ? "Sign in to keep your place across visits." : "Start something and it will be waiting here."}</Empty>
            )}
          </div>
          <div className="min-w-0 xl:vdiv xl:pl-10">
            <RowHeader title="Collections" href="/collections" />
            {previewGenres.length ? (
              <Row>
                {previewGenres.map((genre, index) => (
                  <CollectionCard key={genre.Id} item={genre} kind="genre" count={previews[index]?.count} preview={previews[index]?.item} width={160} />
                ))}
              </Row>
            ) : (
              <Empty>No genres yet.</Empty>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
