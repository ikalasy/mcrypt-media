import Link from "next/link";
import { MediaCard } from "./MediaCard";
import { Empty } from "./Headers";
import type { BaseItem } from "@/lib/types";

export function ItemGrid({ items, emptyText = "Nothing here yet." }: { items: BaseItem[]; emptyText?: string }) {
  if (items.length === 0) return <Empty>{emptyText}</Empty>;
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
      {items.map((item) => (
        <MediaCard key={item.Id} item={item} />
      ))}
    </div>
  );
}

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  /** Builds the href for a given 1-based page number. */
  hrefFor: (page: number) => string;
};

export function Pagination({ page, pageSize, total, hrefFor }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const linkClass = "btn px-4 py-2 text-[0.65rem]";
  return (
    <nav className="mt-10 flex items-center justify-between" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass}>&larr; Prev</Link>
      ) : (
        <span />
      )}
      <span className="label text-muted">
        Page {page} / {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={linkClass}>Next &rarr;</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
