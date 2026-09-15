import { SectionHeader } from "@/components/Headers";
import { ItemGrid } from "@/components/ItemGrid";
import { RequestSearch } from "@/components/RequestSearch";
import { getItems } from "@/lib/jellyfin";
import { hasRequestAccess, isJellyseerrConfigured } from "@/lib/jellyseerr";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

const MAX_QUERY = 120;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireSession();
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, MAX_QUERY);
  const result = query
    ? await getItems(session, { searchTerm: query, types: "Movie,Series,Episode", limit: 60 }).catch(() => null)
    : null;
  const canRequest = !session.isGuest && isJellyseerrConfigured() && hasRequestAccess(session);

  return (
    <div className="space-y-10">
      <SectionHeader
        title="Search"
        aside={
          <span className="label text-muted">
            {session.isGuest ? "Library only for guests" : canRequest ? "Library and requests" : "Library"}
          </span>
        }
      />
      <form action="/search" method="get" className="flex gap-3">
        <input
          className="field"
          name="q"
          defaultValue={query}
          placeholder="Title, series, or episode"
          aria-label="Search"
          maxLength={MAX_QUERY}
          autoFocus
        />
        <button type="submit" className="btn shrink-0">Search</button>
      </form>

      {query && (
        <section>
          <h3 className="label mb-5 flex items-center gap-3">
            In the library
            {result && <span className="text-dim">{result.TotalRecordCount}</span>}
          </h3>
          {result ? (
            <ItemGrid items={result.Items} emptyText={`Nothing in the library matches "${query}".`} />
          ) : (
            <p className="label text-accent">Search failed. The media server may be offline.</p>
          )}
        </section>
      )}

      {query && !session.isGuest && (
        <section>
          <h3 className="label mb-5">Not in the library yet</h3>
          {canRequest ? (
            <RequestSearch key={query} query={query} libraryHit={Boolean(result?.Items.length)} />
          ) : (
            <p className="label border border-dashed border-line px-6 py-8 text-center text-dim">
              {isJellyseerrConfigured()
                ? "Your account is not linked to the request system yet. Ask the admin."
                : "Requests are not configured on this server."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
