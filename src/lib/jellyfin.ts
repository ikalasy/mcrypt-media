import "server-only";
import { APP_NAME, APP_VERSION, getEnv } from "./env";
import type { Session } from "./session";
import type {
  ActivityLogEntry,
  AuthResult,
  BaseItem,
  ItemCounts,
  ItemsResult,
  JellyfinUser,
  SessionInfo,
  SystemInfo,
  SystemStorage,
} from "./types";

const SERVER_DEVICE_ID = "movie-crypted-server";

export class JellyfinError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "JellyfinError";
  }
}

/** Jellyfin's custom auth scheme. The token is omitted for anonymous calls (login). */
export function authorizationHeader(token?: string, deviceId = SERVER_DEVICE_ID): string {
  const parts = [
    `Client="${APP_NAME}"`,
    `Device="Web"`,
    `DeviceId="${deviceId}"`,
    `Version="${APP_VERSION}"`,
  ];
  if (token) parts.push(`Token="${token}"`);
  return `MediaBrowser ${parts.join(", ")}`;
}

type Query = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${getEnv().jellyfinUrl}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

type FetchOptions = {
  token?: string;
  deviceId?: string;
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  query?: Query;
};

/** Typed JSON call to Jellyfin. Throws JellyfinError on non-2xx. */
export async function jf<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      Authorization: authorizationHeader(options.token, options.deviceId),
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new JellyfinError(
      `Jellyfin ${options.method ?? "GET"} ${path} failed with ${response.status}`,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Raw pass-through used by the proxy route. */
export function jellyfinTarget(pathSegments: string[], search: string): string {
  const base = getEnv().jellyfinUrl;
  const path = pathSegments.map(encodeURIComponent).join("/");
  return `${base}/${path}${search}`;
}

export async function authenticate(
  username: string,
  password: string,
  deviceId: string,
): Promise<AuthResult> {
  return jf<AuthResult>("Users/AuthenticateByName", {
    method: "POST",
    deviceId,
    body: { Username: username, Pw: password },
  });
}

/* ---------- Data helpers, each scoped to the logged-in user's token ---------- */

const CARD_FIELDS =
  "PrimaryImageAspectRatio,ParentThumbItemId,ParentBackdropItemId,ParentBackdropImageTags,SeriesPrimaryImageTag,DateCreated";

const DETAIL_FIELDS =
  "Overview,Genres,GenreItems,Studios,People,Taglines,MediaSources,MediaStreams,ProviderIds,ExternalUrls,DateCreated,Path,ChildCount,RecursiveItemCount,ParentThumbItemId,ParentBackdropItemId,ParentBackdropImageTags,SeriesPrimaryImageTag";

function scoped(session: Session): Pick<FetchOptions, "token" | "deviceId"> {
  return { token: session.token, deviceId: session.deviceId };
}

export function getMe(session: Session): Promise<JellyfinUser> {
  return jf<JellyfinUser>("Users/Me", scoped(session));
}

export function getResume(session: Session, limit = 12): Promise<ItemsResult> {
  return jf<ItemsResult>("UserItems/Resume", {
    ...scoped(session),
    query: {
      userId: session.userId,
      limit,
      fields: CARD_FIELDS,
      mediaTypes: "Video",
      enableUserData: true,
      enableTotalRecordCount: false,
    },
  });
}

export function getNextUp(session: Session, limit = 12): Promise<ItemsResult> {
  return jf<ItemsResult>("Shows/NextUp", {
    ...scoped(session),
    query: {
      userId: session.userId,
      limit,
      fields: CARD_FIELDS,
      enableUserData: true,
      enableResumable: false,
      enableTotalRecordCount: false,
    },
  });
}

export function getLatest(session: Session, limit = 16): Promise<BaseItem[]> {
  return jf<BaseItem[]>("Items/Latest", {
    ...scoped(session),
    query: {
      userId: session.userId,
      limit,
      fields: CARD_FIELDS,
      includeItemTypes: "Movie,Series",
      enableUserData: true,
      groupItems: true,
    },
  });
}

export type LibraryQuery = {
  types?: string;
  sortBy?: string;
  sortOrder?: "Ascending" | "Descending";
  startIndex?: number;
  limit?: number;
  searchTerm?: string;
  genreIds?: string;
  parentId?: string;
  filters?: string;
  years?: string;
};

export function getItems(session: Session, query: LibraryQuery = {}): Promise<ItemsResult> {
  return jf<ItemsResult>("Items", {
    ...scoped(session),
    query: {
      userId: session.userId,
      recursive: true,
      includeItemTypes: query.types ?? "Movie,Series",
      sortBy: query.sortBy ?? "SortName",
      sortOrder: query.sortOrder ?? "Ascending",
      startIndex: query.startIndex ?? 0,
      limit: query.limit ?? 60,
      searchTerm: query.searchTerm,
      genreIds: query.genreIds,
      parentId: query.parentId,
      filters: query.filters,
      years: query.years,
      fields: CARD_FIELDS,
      enableUserData: true,
      enableTotalRecordCount: true,
      imageTypeLimit: 1,
    },
  });
}

export function getItem(session: Session, itemId: string): Promise<BaseItem> {
  return jf<BaseItem>(`Items/${encodeURIComponent(itemId)}`, {
    ...scoped(session),
    query: { userId: session.userId, fields: DETAIL_FIELDS },
  });
}

export function getSeasons(session: Session, seriesId: string): Promise<ItemsResult> {
  return jf<ItemsResult>(`Shows/${encodeURIComponent(seriesId)}/Seasons`, {
    ...scoped(session),
    query: { userId: session.userId, fields: CARD_FIELDS, enableUserData: true },
  });
}

export function getEpisodes(
  session: Session,
  seriesId: string,
  seasonId?: string,
): Promise<ItemsResult> {
  return jf<ItemsResult>(`Shows/${encodeURIComponent(seriesId)}/Episodes`, {
    ...scoped(session),
    query: {
      userId: session.userId,
      seasonId,
      fields: `${CARD_FIELDS},Overview`,
      enableUserData: true,
    },
  });
}

export function getSimilar(session: Session, itemId: string, limit = 8): Promise<ItemsResult> {
  return jf<ItemsResult>(`Items/${encodeURIComponent(itemId)}/Similar`, {
    ...scoped(session),
    query: { userId: session.userId, limit, fields: CARD_FIELDS },
  });
}

export function getGenres(session: Session): Promise<ItemsResult> {
  return jf<ItemsResult>("Genres", {
    ...scoped(session),
    query: {
      userId: session.userId,
      includeItemTypes: "Movie,Series",
      sortBy: "SortName",
      enableTotalRecordCount: false,
    },
  });
}

export function getBoxSets(session: Session): Promise<ItemsResult> {
  return jf<ItemsResult>("Items", {
    ...scoped(session),
    query: {
      userId: session.userId,
      recursive: true,
      includeItemTypes: "BoxSet",
      sortBy: "SortName",
      fields: `${CARD_FIELDS},ChildCount`,
      enableTotalRecordCount: false,
    },
  });
}

export type GenrePreview = { count: number; item?: BaseItem };

/** Title count plus the newest title in a genre, for collection cards. One request per genre. */
export async function getGenrePreview(session: Session, genreId: string): Promise<GenrePreview> {
  const result = await getItems(session, {
    genreIds: genreId,
    limit: 1,
    sortBy: "DateCreated,SortName",
    sortOrder: "Descending",
  });
  return { count: result.TotalRecordCount, item: result.Items[0] };
}

/** Fetch specific items by id in one call (names and artwork for history rows). */
export function getItemsByIds(session: Session, ids: string[]): Promise<ItemsResult> {
  if (ids.length === 0) return Promise.resolve({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
  return jf<ItemsResult>("Items", {
    ...scoped(session),
    query: { userId: session.userId, ids: ids.join(","), fields: CARD_FIELDS, enableImages: false },
  });
}

export function getCounts(session: Session): Promise<ItemCounts> {
  return jf<ItemCounts>("Items/Counts", {
    ...scoped(session),
    query: { userId: session.userId },
  });
}

/* ---------- Admin-level calls: session token if admin, else the server API key ---------- */

function adminAuth(session: Session | null): Pick<FetchOptions, "token" | "deviceId"> | null {
  if (session?.isAdmin) return scoped(session);
  const apiKey = getEnv().jellyfinApiKey;
  return apiKey ? { token: apiKey } : null;
}

export async function getSystemInfo(session: Session | null): Promise<SystemInfo | null> {
  const auth = adminAuth(session);
  if (!auth) return null;
  return jf<SystemInfo>("System/Info", auth);
}

export async function getStorage(session: Session | null): Promise<SystemStorage | null> {
  const auth = adminAuth(session);
  if (!auth) return null;
  return jf<SystemStorage>("System/Info/Storage", auth);
}

/** Sessions visible to the caller. Admins see everyone; everyone else sees only their own. */
export async function getSessions(session: Session): Promise<SessionInfo[]> {
  const auth = adminAuth(session) ?? scoped(session);
  const sessions = await jf<SessionInfo[]>("Sessions", {
    ...auth,
    query: { activeWithinSeconds: 960 },
  });
  return session.isAdmin ? sessions : sessions.filter((s) => s.UserId === session.userId);
}

/** Playback entries from Jellyfin's activity log since `since`. Admin only; empty otherwise. */
export async function getPlaybackActivity(
  session: Session,
  since: Date,
  limit = 2000,
): Promise<ActivityLogEntry[]> {
  const auth = adminAuth(session);
  if (!auth) return [];
  const page = await jf<{ Items: ActivityLogEntry[] }>("System/ActivityLog/Entries", {
    ...auth,
    query: { minDate: since.toISOString(), hasUserId: true, limit, startIndex: 0 },
  });
  return page.Items.filter((entry) => entry.Type === "VideoPlayback" || entry.Type === "AudioPlayback");
}

/** All user accounts, for mapping ids to names. Admin only; empty otherwise. */
export async function getUsers(session: Session): Promise<JellyfinUser[]> {
  const auth = adminAuth(session);
  if (!auth) return [];
  return jf<JellyfinUser[]>("Users", auth);
}

export function pingServer(): Promise<{ Version: string; ServerName: string }> {
  return jf("System/Info/Public");
}
