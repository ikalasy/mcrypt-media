import type { BaseItem } from "./types";

/** Every image is fetched through the authenticated proxy so Jellyfin never needs to be public. */
export const PROXY_BASE = "/api/jf";

type ImageType = "Primary" | "Backdrop" | "Thumb" | "Logo";

type ImageOptions = {
  tag?: string;
  fillWidth?: number;
  fillHeight?: number;
  maxWidth?: number;
  quality?: number;
  index?: number;
};

export function imageUrl(
  itemId: string,
  type: ImageType,
  options: ImageOptions = {},
): string {
  const params = new URLSearchParams();
  if (options.tag) params.set("tag", options.tag);
  if (options.fillWidth) params.set("fillWidth", String(options.fillWidth));
  if (options.fillHeight) params.set("fillHeight", String(options.fillHeight));
  if (options.maxWidth) params.set("maxWidth", String(options.maxWidth));
  params.set("quality", String(options.quality ?? 90));
  const suffix = options.index !== undefined ? `/${options.index}` : "";
  return `${PROXY_BASE}/Items/${itemId}/Images/${type}${suffix}?${params.toString()}`;
}

/** Landscape artwork for cards: Thumb, then Backdrop, then Primary, walking up to the series. */
export function cardImage(item: BaseItem, width = 480): string | null {
  const height = Math.round((width * 9) / 16);
  const fill = { fillWidth: width, fillHeight: height };
  if (item.ImageTags?.Thumb) {
    return imageUrl(item.Id, "Thumb", { tag: item.ImageTags.Thumb, ...fill });
  }
  if (item.BackdropImageTags?.length) {
    return imageUrl(item.Id, "Backdrop", {
      tag: item.BackdropImageTags[0],
      index: 0,
      ...fill,
    });
  }
  if (item.Type === "Episode" && item.ImageTags?.Primary) {
    return imageUrl(item.Id, "Primary", { tag: item.ImageTags.Primary, ...fill });
  }
  if (item.ParentThumbItemId && item.ParentThumbImageTag) {
    return imageUrl(item.ParentThumbItemId, "Thumb", {
      tag: item.ParentThumbImageTag,
      ...fill,
    });
  }
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) {
    return imageUrl(item.ParentBackdropItemId, "Backdrop", {
      tag: item.ParentBackdropImageTags[0],
      index: 0,
      ...fill,
    });
  }
  if (item.ImageTags?.Primary) {
    return imageUrl(item.Id, "Primary", { tag: item.ImageTags.Primary, ...fill });
  }
  return null;
}

/** Full-width backdrop for hero and detail pages. */
export function backdropImage(item: BaseItem, width = 1600): string | null {
  if (item.BackdropImageTags?.length) {
    return imageUrl(item.Id, "Backdrop", {
      tag: item.BackdropImageTags[0],
      maxWidth: width,
      index: 0,
    });
  }
  if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) {
    return imageUrl(item.ParentBackdropItemId, "Backdrop", {
      tag: item.ParentBackdropImageTags[0],
      maxWidth: width,
      index: 0,
    });
  }
  return cardImage(item, width);
}

/** Portrait poster, used on detail pages and search results. */
export function posterImage(item: BaseItem, width = 300): string | null {
  const height = Math.round(width * 1.5);
  if (item.ImageTags?.Primary && item.Type !== "Episode") {
    return imageUrl(item.Id, "Primary", {
      tag: item.ImageTags.Primary,
      fillWidth: width,
      fillHeight: height,
    });
  }
  if (item.SeriesId && item.SeriesPrimaryImageTag) {
    return imageUrl(item.SeriesId, "Primary", {
      tag: item.SeriesPrimaryImageTag,
      fillWidth: width,
      fillHeight: height,
    });
  }
  return null;
}
