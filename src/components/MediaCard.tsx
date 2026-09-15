import Link from "next/link";
import { cardImage } from "@/lib/images";
import { episodeCode, formatClock, playedPercent, ticksToSeconds } from "@/lib/format";
import type { BaseItem } from "@/lib/types";

type Props = {
  item: BaseItem;
  /** Show the resume progress line instead of the year. */
  progress?: boolean;
  /** Fixed card width for horizontal rows; omit for grid cells. */
  width?: number;
  priority?: boolean;
};

function cardHref(item: BaseItem): string {
  return item.Type === "Episode" ? `/watch/${item.Id}` : `/item/${item.Id}`;
}

function titleFor(item: BaseItem): string {
  return item.Type === "Episode" && item.SeriesName ? item.SeriesName : item.Name;
}

function subtitleFor(item: BaseItem, progress: boolean): string {
  if (progress) {
    const position = ticksToSeconds(item.UserData?.PlaybackPositionTicks);
    const runtime = ticksToSeconds(item.RunTimeTicks);
    const code = item.Type === "Episode" ? episodeCode(item.ParentIndexNumber, item.IndexNumber) : "";
    const clock = runtime ? `${formatClock(position)} / ${formatClock(runtime)}` : "";
    return [code, clock].filter(Boolean).join(" · ");
  }
  if (item.Type === "Episode") {
    return [episodeCode(item.ParentIndexNumber, item.IndexNumber), item.Name].filter(Boolean).join(" · ");
  }
  return item.ProductionYear ? String(item.ProductionYear) : "";
}

export function MediaCard({ item, progress = false, width, priority = false }: Props) {
  const image = cardImage(item, 480);
  const percent = progress ? playedPercent(item.UserData?.PlaybackPositionTicks, item.RunTimeTicks) : 0;
  const style = width ? { width, minWidth: width } : undefined;

  return (
    <Link href={cardHref(item)} className="group block shrink-0" style={style}>
      <div className="relative aspect-video overflow-hidden border border-line bg-panel">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
          <img
            src={image}
            alt=""
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="art-empty flex h-full w-full items-center justify-center">
            <span className="slash text-3xl">{"//"}</span>
          </div>
        )}
        {item.UserData?.Played && !progress && (
          <span className="label absolute right-2 top-2 bg-bg/80 px-1.5 py-0.5 text-[0.6rem] text-muted">
            Watched
          </span>
        )}
        <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors group-hover:border-accent" />
      </div>
      {progress && (
        <div className="progress mt-[6px]" aria-label={`${Math.round(percent)}% watched`}>
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
      <p className="label mt-3 truncate text-text">{titleFor(item)}</p>
      <p className="label mt-1 truncate text-[0.62rem] text-muted">{subtitleFor(item, progress) || " "}</p>
    </Link>
  );
}
