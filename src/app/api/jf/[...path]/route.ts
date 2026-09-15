import { type NextRequest } from "next/server";
import {
  applyGuestPlaybackQuery,
  guestMayCall,
  guestMayCancelEncoding,
  rewriteGuestPlaybackInfo,
  trackGuestReport,
} from "@/lib/guest-proxy";
import { getGuestToken, invalidateGuestToken } from "@/lib/guest-token";
import { authorizationHeader, jellyfinTarget } from "@/lib/jellyfin";
import { getSession, type Session } from "@/lib/session";
import type { PlaybackInfoResponse } from "@/lib/types";

/**
 * Authenticated pass-through to Jellyfin. The browser never sees the Jellyfin
 * token; it lives in the encrypted session cookie and is attached here. Images,
 * direct-play streams, and HLS segments all flow through this route, so Jellyfin
 * itself can stay on the LAN.
 */

const PROXY_PREFIX = "/api/jf";
const IMAGE_CACHE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Reads are allow-listed to what the UI actually needs. Anything else, including
 * endpoints Jellyfin adds in the future, is refused by default.
 */
const ALLOW_GET_EXACT = new Set([
  "items",
  "items/latest",
  "items/counts",
  "items/filters2",
  "useritems/resume",
  "shows/nextup",
  "genres",
  "sessions",
  "search/hints",
  "system/info/public",
  "system/ping",
  "users/me",
  "userimage",
]);

const ALLOW_GET_PREFIX = [
  "items/", // item detail, similar, images, playbackinfo (GET form)
  "useritems/", // per-item user data
  "shows/", // seasons and episodes
  "genres/",
  "videos/", // direct streams, HLS playlists and segments, subtitles
];

/** Writes are allow-listed: playback, progress, favorites, watched state. */
const ALLOW_POST = [
  "sessions/playing",
  "sessions/playing/progress",
  "sessions/playing/stopped",
  "userfavoriteitems/",
  "userplayeditems/",
  "useritems/",
];

const ALLOW_DELETE = ["videos/activeencodings", "userfavoriteitems/", "userplayeditems/"];

const FORWARD_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "range",
  "if-none-match",
  "if-modified-since",
  "content-type",
];

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
  "cache-control",
  "content-disposition",
];

function normalizedPath(segments: string[]): string {
  return segments.join("/").toLowerCase();
}

function isAllowed(method: string, path: string): boolean {
  if (path.split("/").some((segment) => segment === ".." || segment === "")) return false;
  if (method === "GET" || method === "HEAD") {
    if (ALLOW_GET_EXACT.has(path)) return true;
    return ALLOW_GET_PREFIX.some((prefix) => path.startsWith(prefix));
  }
  if (method === "POST") {
    if (path.startsWith("items/")) return path.endsWith("/playbackinfo");
    return ALLOW_POST.some((prefix) => path.startsWith(prefix));
  }
  if (method === "DELETE") {
    return ALLOW_DELETE.some((prefix) => path.startsWith(prefix));
  }
  return false;
}

function requestHeaders(request: NextRequest, session: Session): Headers {
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Authorization", authorizationHeader(session.token, session.deviceId));
  return headers;
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const wasEncoded = upstream.headers.has("content-encoding");
  for (const name of FORWARD_RESPONSE_HEADERS) {
    if (wasEncoded && name === "content-length") continue;
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

/** Jellyfin appends the caller's token to stream and subtitle URLs; the proxy authenticates, so drop it. */
function stripToken(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.replace(/([?&])(?:api_key|ApiKey)=[^&]*&?/gi, "$1").replace(/[?&]$/, "");
}

function stripTokensFromPlaybackInfo(info: PlaybackInfoResponse): PlaybackInfoResponse {
  return {
    ...info,
    MediaSources: (info.MediaSources ?? []).map((source) => ({
      ...source,
      TranscodingUrl: stripToken(source.TranscodingUrl),
      MediaStreams: (source.MediaStreams ?? []).map((stream) => ({
        ...stream,
        DeliveryUrl: stripToken(stream.DeliveryUrl),
      })),
    })),
  };
}

/** HLS playlists reference sibling URLs; root-relative ones must be pointed back at the proxy. */
function rewritePlaylist(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.startsWith("/") ? `${PROXY_PREFIX}${line}` : line))
    .join("\n");
}

async function handle(request: NextRequest, context: RouteContext<"/api/jf/[...path]">) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { path } = await context.params;
  const method = request.method.toUpperCase();
  const lowerPath = normalizedPath(path);
  const search = new URLSearchParams(request.nextUrl.search);
  if (!isAllowed(method, lowerPath)) {
    return Response.json({ error: "Not allowed through the proxy." }, { status: 403 });
  }
  const isGuest = Boolean(session.isGuest);
  const visitorId = session.visitorId ?? "guest";
  if (isGuest && !guestMayCall(method, lowerPath, search)) {
    return Response.json({ error: "Guests cannot do that. Sign in for full access." }, { status: 403 });
  }
  // Cancelling a transcode is scoped to the caller: members by device, guests by stream ownership.
  if (method === "DELETE" && lowerPath.startsWith("videos/activeencodings")) {
    if (isGuest && !guestMayCancelEncoding(search, visitorId)) {
      return Response.json({ error: "Not your stream." }, { status: 403 });
    }
    search.set("deviceId", session.deviceId);
  }

  // Never let the client act as another user: any userId in the query is pinned to the session.
  const isPlaybackInfo = lowerPath.endsWith("/playbackinfo");
  if (search.has("userId") || isPlaybackInfo) search.set("userId", session.userId);
  if (isGuest && isPlaybackInfo) applyGuestPlaybackQuery(search);
  const query = search.toString();
  const target = jellyfinTarget(path, query ? `?${query}` : "");
  const hasBody = method === "POST";

  // Guest playback reports are buffered so the one-stream ledger can read the PlaySessionId.
  let body: BodyInit | null | undefined = hasBody ? request.body : undefined;
  if (isGuest && hasBody && lowerPath.startsWith("sessions/playing")) {
    const text = await request.text();
    try {
      trackGuestReport(lowerPath, JSON.parse(text) as { PlaySessionId?: string }, visitorId);
    } catch {
      /* not JSON; Jellyfin will reject it */
    }
    body = text;
  }

  const send = (token: string) =>
    fetch(target, {
      method,
      headers: requestHeaders(request, { ...session, token }),
      body,
      // Node needs this to stream a request body.
      ...(hasBody && typeof body !== "string" ? { duplex: "half" as const } : {}),
      redirect: "manual",
      cache: "no-store",
      signal: request.signal,
    } as RequestInit);

  let upstream: Response;
  try {
    upstream = await send(session.token);
    if (isGuest && upstream.status === 401 && (!hasBody || typeof body === "string")) {
      // The shared guest token was revoked: sign in again and retry once.
      invalidateGuestToken();
      const fresh = await getGuestToken();
      if (fresh) upstream = await send(fresh);
    }
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error(`[proxy] ${method} ${target} failed:`, error);
    return Response.json({ error: "Media server unreachable." }, { status: 502 });
  }

  const headers = responseHeaders(upstream);
  // Artwork URLs carry the image tag, which changes when the image does, so the browser may cache them.
  if (upstream.ok && (lowerPath.includes("/images/") || lowerPath === "userimage") && search.has("tag")) {
    headers.set("Cache-Control", `private, max-age=${IMAGE_CACHE_SECONDS}, immutable`);
  }
  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("mpegurl")) {
    headers.delete("content-length");
    return new Response(rewritePlaylist(await upstream.text()), {
      status: upstream.status,
      headers,
    });
  }
  if (isPlaybackInfo && upstream.ok) {
    const info = stripTokensFromPlaybackInfo((await upstream.json()) as PlaybackInfoResponse);
    const result = isGuest ? rewriteGuestPlaybackInfo(info, visitorId) : info;
    if ("error" in result) return Response.json(result, { status: 429 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const DELETE = handle;
