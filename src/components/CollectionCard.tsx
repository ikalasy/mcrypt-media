import Link from "next/link";
import { cardImage } from "@/lib/images";
import type { BaseItem } from "@/lib/types";

type Props = {
  item: BaseItem;
  kind: "genre" | "boxset";
  count?: number;
  /** A title from inside the collection whose artwork represents it (genres have none of their own). */
  preview?: BaseItem;
  width?: number;
};

export function CollectionCard({ item, kind, count, preview, width }: Props) {
  const source = kind === "boxset" ? item : preview;
  const image = source ? cardImage(source, 400) : null;
  const total = count ?? item.ChildCount ?? item.RecursiveItemCount;
  const style = width ? { width, minWidth: width } : undefined;
  return (
    <Link
      href={`/collections/${item.Id}?kind=${kind}`}
      className="group block shrink-0"
      style={style}
    >
      <div className="relative aspect-[1.55] overflow-hidden border border-line bg-panel">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-panel-2">
            <span className="slash text-3xl">{"//"}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/70 to-transparent" />
        <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors group-hover:border-accent" />
      </div>
      <p className="label mt-3 truncate">{item.Name}</p>
      <p className="label mt-1 text-[0.62rem] text-muted">
        {total !== undefined ? `${total} title${total === 1 ? "" : "s"}` : " "}
      </p>
    </Link>
  );
}
