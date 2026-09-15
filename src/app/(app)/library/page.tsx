import Link from "next/link";
import { SectionHeader } from "@/components/Headers";
import { ItemGrid, Pagination } from "@/components/ItemGrid";
import { getItems, getResume } from "@/lib/jellyfin";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Library" };

const PAGE_SIZE = 48;

const TYPE_OPTIONS = [
  { key: "all", label: "All", types: "Movie,Series" },
  { key: "movies", label: "Movies", types: "Movie" },
  { key: "series", label: "Series", types: "Series" },
] as const;

const SORT_OPTIONS = [
  { key: "SortName", label: "A-Z" },
  { key: "DateCreated", label: "Added" },
  { key: "ProductionYear", label: "Year" },
  { key: "CommunityRating", label: "Rating" },
] as const;

type Search = { type?: string; sort?: string; order?: string; page?: string; filter?: string };

function parse(search: Search) {
  const type = TYPE_OPTIONS.find((t) => t.key === search.type) ?? TYPE_OPTIONS[0];
  const sort = SORT_OPTIONS.find((s) => s.key === search.sort) ?? SORT_OPTIONS[0];
  const defaultOrder = sort.key === "SortName" ? "Ascending" : "Descending";
  const order: "Ascending" | "Descending" =
    search.order === "Ascending" || search.order === "Descending" ? search.order : defaultOrder;
  const page = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  return { type, sort, order, page, filter: search.filter === "resume" ? "resume" : undefined };
}

function href(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== 1) query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `/library?${text}` : "/library";
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireSession();
  const { type, sort, order, page, filter } = parse(await searchParams);

  const result = filter
    ? await getResume(session, 100)
    : await getItems(session, {
        types: type.types,
        sortBy: sort.key === "SortName" ? "SortName" : `${sort.key},SortName`,
        sortOrder: order,
        startIndex: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      });

  const chip = (active: boolean) =>
    `label px-3 py-1.5 border transition-colors ${active ? "border-accent text-text" : "border-line text-muted hover:text-text"}`;

  return (
    <div className="space-y-8">
      <SectionHeader
        title={filter ? "Continue watching" : "The Library"}
        aside={<span className="label text-muted">{result.TotalRecordCount ?? result.Items.length} titles</span>}
      />

      {!filter && (
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex gap-2">
            {TYPE_OPTIONS.map((t) => (
              <Link key={t.key} href={href({ type: t.key === "all" ? undefined : t.key, sort: sort.key === "SortName" ? undefined : sort.key, order: order === "Ascending" ? undefined : order })} className={chip(t.key === type.key)}>
                {t.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-2">
            {SORT_OPTIONS.map((s) => (
              <Link
                key={s.key}
                href={href({ type: type.key === "all" ? undefined : type.key, sort: s.key === "SortName" ? undefined : s.key, order: s.key === "SortName" ? undefined : "Descending" })}
                className={chip(s.key === sort.key)}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <ItemGrid items={result.Items} emptyText={filter ? "Nothing in progress." : "No titles match."} />

      {!filter && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={result.TotalRecordCount}
          hrefFor={(p) => href({ type: type.key === "all" ? undefined : type.key, sort: sort.key === "SortName" ? undefined : sort.key, order: order === "Ascending" ? undefined : order, page: p })}
        />
      )}
    </div>
  );
}
