import { CollectionCard } from "@/components/CollectionCard";
import { Empty, RowHeader, SectionHeader } from "@/components/Headers";
import { getBoxSets, getGenrePreview, getGenres } from "@/lib/jellyfin";
import { requireSession } from "@/lib/session";
import type { BaseItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const session = await requireSession();
  const [genres, boxSets] = await Promise.all([
    getGenres(session).catch(() => ({ Items: [] as BaseItem[] })),
    getBoxSets(session).catch(() => ({ Items: [] as BaseItem[] })),
  ]);
  const previews = await Promise.all(
    genres.Items.map((g) => getGenrePreview(session, g.Id).catch(() => ({ count: undefined, item: undefined }))),
  );

  const grid = "grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8";

  return (
    <div className="space-y-12">
      <SectionHeader title="Collections" />

      <section>
        <RowHeader title="Genres" count={genres.Items.length} />
        {genres.Items.length ? (
          <div className={grid}>
            {genres.Items.map((genre, index) => (
              <CollectionCard key={genre.Id} item={genre} kind="genre" count={previews[index]?.count} preview={previews[index]?.item} />
            ))}
          </div>
        ) : (
          <Empty>No genres yet.</Empty>
        )}
      </section>

      <section>
        <RowHeader title="Box sets" count={boxSets.Items.length} />
        {boxSets.Items.length ? (
          <div className={grid}>
            {boxSets.Items.map((set) => (
              <CollectionCard key={set.Id} item={set} kind="boxset" />
            ))}
          </div>
        ) : (
          <Empty>No box sets. Create collections in Jellyfin and they appear here.</Empty>
        )}
      </section>
    </div>
  );
}
