/** Jellyseerr types and enums safe to import from client components. */

export type SeerrMediaType = "movie" | "tv" | "person";

/** Jellyseerr MediaStatus enum. */
export const MEDIA_STATUS = {
  1: "UNKNOWN",
  2: "PENDING",
  3: "PROCESSING",
  4: "PARTIAL",
  5: "AVAILABLE",
} as const;

/** Jellyseerr MediaRequestStatus enum. */
export const REQUEST_STATUS = {
  1: "PENDING",
  2: "APPROVED",
  3: "DECLINED",
  4: "FAILED",
  5: "COMPLETED",
} as const;

export type SeerrSearchResult = {
  id: number;
  mediaType: SeerrMediaType;
  title?: string;
  name?: string;
  releaseDate?: string;
  firstAirDate?: string;
  overview?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage?: number;
  mediaInfo?: {
    status: keyof typeof MEDIA_STATUS;
    jellyfinMediaId?: string | null;
    requests?: { id: number; status: keyof typeof REQUEST_STATUS }[];
  };
};

export type SeerrRequest = {
  id: number;
  status: keyof typeof REQUEST_STATUS;
  type: "movie" | "tv";
  createdAt: string;
  is4k?: boolean;
  requestedBy?: { displayName?: string; jellyfinUsername?: string; email?: string };
  media: {
    id: number;
    tmdbId: number;
    mediaType: "movie" | "tv";
    status: keyof typeof MEDIA_STATUS;
    jellyfinMediaId?: string | null;
  };
  seasons?: { seasonNumber: number }[];
};

export type SeerrRequestWithTitle = SeerrRequest & {
  title: string;
  year?: string;
  posterPath?: string | null;
};

export function tmdbImage(path?: string | null, size: "w300" | "w780" = "w300"): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}
