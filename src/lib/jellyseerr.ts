import "server-only";
import { getEnv } from "./env";
import type { Session } from "./session";

const LOGIN_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;

export class JellyseerrError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "JellyseerrError";
  }
}

export {
  MEDIA_STATUS,
  REQUEST_STATUS,
  tmdbImage,
  type SeerrMediaType,
  type SeerrRequest,
  type SeerrRequestWithTitle,
  type SeerrSearchResult,
} from "./seerr-shared";
import type { SeerrRequest, SeerrRequestWithTitle, SeerrSearchResult } from "./seerr-shared";

export function isJellyseerrConfigured(): boolean {
  return Boolean(getEnv().jellyseerrUrl);
}

function authHeaders(session: Session | null): Record<string, string> {
  const { jellyseerrApiKey } = getEnv();
  if (session?.jellyseerrCookie) {
    return { Cookie: `connect.sid=${session.jellyseerrCookie}` };
  }
  if (jellyseerrApiKey) return { "X-Api-Key": jellyseerrApiKey };
  return {};
}

export function hasRequestAccess(session: Session | null): boolean {
  if (session?.isGuest) return false;
  return Boolean(session?.jellyseerrCookie || getEnv().jellyseerrApiKey);
}

/** Admin view needs the server API key; the linked cookie only sees the user's own requests. */
export function hasAdminRequestAccess(): boolean {
  return Boolean(getEnv().jellyseerrApiKey);
}

async function seerr<T>(
  path: string,
  session: Session | null,
  init: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string | number> } = {},
): Promise<T> {
  const url = new URL(`${getEnv().jellyseerrUrl}/api/v1/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(session),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const json = (await response.json()) as { message?: string };
      detail = json.message ?? "";
    } catch {
      /* body was not JSON */
    }
    throw new JellyseerrError(
      detail || `Jellyseerr ${init.method ?? "GET"} ${path} failed with ${response.status}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

/**
 * Log the user into Jellyseerr with the same Jellyfin credentials so requests are
 * attributed to them. Returns the `connect.sid` value, or null when Jellyseerr is
 * not configured, the login fails, or the user does not exist there yet.
 */
export async function loginToJellyseerr(
  username: string,
  password: string,
): Promise<string | null> {
  const { jellyseerrUrl } = getEnv();
  if (!jellyseerrUrl) return null;
  try {
    const response = await fetch(`${jellyseerrUrl}/api/v1/auth/jellyfin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(`[jellyseerr] link failed for "${username}": HTTP ${response.status} ${detail.slice(0, 200)}`);
      return null;
    }
    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookie) {
      const match = /^connect\.sid=([^;]+)/.exec(cookie);
      if (match) return match[1];
    }
    console.warn(`[jellyseerr] link for "${username}" returned no session cookie`);
    return null;
  } catch (error) {
    console.warn(`[jellyseerr] link for "${username}" threw:`, error);
    return null;
  }
}

export function searchMedia(
  session: Session | null,
  query: string,
  page = 1,
): Promise<{ results: SeerrSearchResult[]; totalResults: number; totalPages: number }> {
  // Jellyseerr insists on percent-encoding here; URLSearchParams would send spaces as "+" and get a 400.
  return seerr(`search?query=${encodeURIComponent(query)}&page=${page}`, session);
}

export function createRequest(
  session: Session | null,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<SeerrRequest> {
  const body =
    mediaType === "tv"
      ? { mediaType, mediaId: tmdbId, seasons: "all" }
      : { mediaType, mediaId: tmdbId };
  return seerr("request", session, { method: "POST", body });
}

type MediaDetails = {
  title?: string;
  name?: string;
  releaseDate?: string;
  firstAirDate?: string;
  posterPath?: string | null;
};

async function fetchTitle(
  session: Session | null,
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<Pick<SeerrRequestWithTitle, "title" | "year" | "posterPath">> {
  try {
    const details = await seerr<MediaDetails>(`${mediaType}/${tmdbId}`, session);
    const date = details.releaseDate ?? details.firstAirDate ?? "";
    return {
      title: details.title ?? details.name ?? `TMDB ${tmdbId}`,
      year: date ? date.slice(0, 4) : undefined,
      posterPath: details.posterPath ?? null,
    };
  } catch {
    return { title: `TMDB ${tmdbId}` };
  }
}

export async function listRequests(
  session: Session | null,
  take = 20,
): Promise<SeerrRequestWithTitle[]> {
  const page = await seerr<{ results: SeerrRequest[] }>("request", session, {
    query: { take, skip: 0, sort: "added", filter: "all" },
  });
  return Promise.all(
    page.results.map(async (request) => ({
      ...request,
      ...(await fetchTitle(session, request.media.mediaType, request.media.tmdbId)),
    })),
  );
}

export type RequestSummary = {
  total: number;
  pending: number;
  approved: number;
  available: number;
  declined: number;
  recent: SeerrRequestWithTitle[];
};

/** Every user's requests, via the API key. Empty summary when the key is missing. */
export async function summarizeAllRequests(take = 25): Promise<RequestSummary | null> {
  if (!hasAdminRequestAccess()) return null;
  const page = await seerr<{ pageInfo: { results: number }; results: SeerrRequest[] }>("request", null, {
    query: { take: 500, skip: 0, sort: "added", filter: "all" },
  });
  const all = page.results;
  const recent = await Promise.all(
    all.slice(0, take).map(async (request) => ({
      ...request,
      ...(await fetchTitle(null, request.media.mediaType, request.media.tmdbId)),
    })),
  );
  return {
    total: page.pageInfo?.results ?? all.length,
    pending: all.filter((r) => r.status === 1).length,
    approved: all.filter((r) => r.status === 2 && r.media.status !== 5).length,
    available: all.filter((r) => r.media.status === 5).length,
    declined: all.filter((r) => r.status === 3 || r.status === 4).length,
    recent,
  };
}
