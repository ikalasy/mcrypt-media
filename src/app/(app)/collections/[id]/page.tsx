import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/Headers";
import { ItemGrid, Pagination } from "@/components/ItemGrid";
import { getItem, getItems } from "@/lib/jellyfin";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;

type Params = Promise<{ id: string }>;
type Search = Promise<{ kind?: string; page?: string }>;

export default async function CollectionPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const session = await requireSession();
  const { id } = await params;
  const { kind, page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const isBoxSet = kind === "boxset";

  const collection = await getItem(session, id).catch(() => null);
  if (!collection) notFound();

  const result = await getItems(session, {
    ...(isBoxSet ? { parentId: id, types: "Movie,Series,Episode" } : { genreIds: id }),
    sortBy: isBoxSet ? "SortName" : "ProductionYear,SortName",
    sortOrder: isBoxSet ? "Ascending" : "Descending",
    startIndex: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  return (
    <div className="space-y-8">
      <SectionHeader
        title={collection.Name}
        aside={<span className="label text-muted">{result.TotalRecordCount} titles</span>}
      />
      {collection.Overview && <p className="max-w-[70ch] text-[0.8rem] leading-relaxed text-muted">{collection.Overview}</p>}
      <ItemGrid items={result.Items} />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={result.TotalRecordCount}
        hrefFor={(p) => `/collections/${id}?kind=${isBoxSet ? "boxset" : "genre"}${p > 1 ? `&page=${p}` : ""}`}
      />
    </div>
  );
}
