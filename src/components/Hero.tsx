import Link from "next/link";
import { backdropImage } from "@/lib/images";
import { formatRuntime, qualityLabel } from "@/lib/format";
import type { BaseItem } from "@/lib/types";

export const OVERVIEW_LIMIT = 280;

export function trimOverview(text: string | undefined, limit = OVERVIEW_LIMIT): string {
  if (!text) return "";
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function heroMeta(item: BaseItem): string[] {
  const video = item.MediaStreams?.find((s) => s.Type === "Video");
  return [
    item.ProductionYear ? String(item.ProductionYear) : "",
    item.Genres?.[0] ?? "",
    item.Type === "Series"
      ? item.ChildCount
        ? `${item.ChildCount} SEASON${item.ChildCount === 1 ? "" : "S"}`
        : "SERIES"
      : formatRuntime(item.RunTimeTicks),
    video ? qualityLabel(video.Width, video.Height, video.VideoRangeType ?? video.VideoRange) : "",
  ].filter(Boolean);
}

export function Hero({ item, label = "Featured" }: { item: BaseItem; label?: string }) {
  const image = backdropImage(item, 1600);
  const meta = heroMeta(item);
  const playHref = item.Type === "Movie" ? `/watch/${item.Id}` : `/item/${item.Id}`;

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Link href={`/item/${item.Id}`} className="relative block aspect-video overflow-hidden border border-line bg-panel">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
          <img src={image} alt="" className="h-full w-full object-cover" loading="eager" />
        ) : (
          <div className="art-empty h-full w-full" />
        )}
      </Link>

      <div className="flex flex-col justify-center py-2">
        <p className="label flex items-center gap-3 text-text">
          {label}
          <span aria-hidden className="inline-block h-px w-6 bg-accent" />
        </p>
        <h1 className="mt-5 text-3xl font-medium uppercase leading-tight tracking-[0.12em] sm:text-4xl xl:text-5xl">
          {item.Name}
        </h1>
        {meta.length > 0 && (
          <p className="label mt-5 text-muted">{meta.join("  /  ")}</p>
        )}
        {item.Overview && (
          <p className="mt-6 max-w-[52ch] text-[0.8rem] leading-relaxed text-muted">
            {trimOverview(item.Overview)}
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href={playHref} className="btn">
            <span aria-hidden>&#9654;</span>
            {item.Type === "Movie" ? "Play" : "Episodes"}
          </Link>
          <Link href={`/item/${item.Id}`} className="btn border-transparent text-muted hover:text-text">
            Details
          </Link>
        </div>
      </div>
    </section>
  );
}
