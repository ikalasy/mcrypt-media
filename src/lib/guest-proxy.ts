import "server-only";
import { GUEST_MAX_BITRATE, GUEST_MAX_HEIGHT, GUEST_MAX_WIDTH } from "./guest";
import { canStartGuestStream, endGuestStream, ownsGuestStream, startGuestStream, touchGuestStream } from "./guest-streams";
import type { PlaybackInfoResponse } from "./types";

/**
 * Rules the proxy applies to guest sessions on top of the normal allow-lists:
 * no writes except playback reporting, no direct streams, every transcode
 * capped to 720p, and one guest stream at a time.
 */

const GUEST_POST_ALLOW = ["sessions/playing", "sessions/playing/progress", "sessions/playing/stopped"];
const GUEST_DELETE_ALLOW = ["videos/activeencodings"];

/** Whether a guest may make this call at all. `path` is lower-cased, no leading slash. */
export function guestMayCall(method: string, path: string, search: URLSearchParams): boolean {
  if (method === "GET" || method === "HEAD") {
    // Direct/static streams bypass the transcode cap; guests only get HLS.
    if (/^videos\/[^/]+\/stream(\.[a-z0-9]+)?$/.test(path)) return false;
    if (path.startsWith("videos/") && search.get("static") === "true") return false;
    return true;
  }
  if (method === "POST") {
    if (path.endsWith("/playbackinfo")) return true;
    return GUEST_POST_ALLOW.some((prefix) => path.startsWith(prefix));
  }
  if (method === "DELETE") return GUEST_DELETE_ALLOW.some((prefix) => path.startsWith(prefix));
  return false;
}

/** Force transcoding at a capped bitrate on PlaybackInfo. */
export function applyGuestPlaybackQuery(search: URLSearchParams): void {
  search.set("enableDirectPlay", "false");
  search.set("enableDirectStream", "false");
  search.set("enableTranscoding", "true");
  search.set("maxStreamingBitrate", String(GUEST_MAX_BITRATE));
}

/** Pin the transcode URL Jellyfin hands back to 720p and register the stream to this visitor. */
export function rewriteGuestPlaybackInfo(
  json: PlaybackInfoResponse,
  visitorId: string,
): PlaybackInfoResponse | { error: string } {
  if (!canStartGuestStream(json.PlaySessionId, visitorId)) {
    return { error: "The guest stream is in use right now. Try again in a minute, or sign in." };
  }
  startGuestStream(json.PlaySessionId, visitorId);
  return {
    ...json,
    MediaSources: (json.MediaSources ?? []).map((source) => ({
      ...source,
      SupportsDirectPlay: false,
      SupportsDirectStream: false,
      TranscodingUrl: source.TranscodingUrl
        ? `${source.TranscodingUrl}&maxWidth=${GUEST_MAX_WIDTH}&maxHeight=${GUEST_MAX_HEIGHT}&videoBitRate=${GUEST_MAX_BITRATE}`
        : source.TranscodingUrl,
    })),
  };
}

/** Keep the one-stream ledger in sync with the player's reports (owner-checked). */
export function trackGuestReport(path: string, body: { PlaySessionId?: string } | null, visitorId: string): void {
  const id = body?.PlaySessionId;
  if (!id) return;
  if (path === "sessions/playing/stopped") endGuestStream(id, visitorId);
  else touchGuestStream(id, visitorId);
}

/** Guests may only cancel transcodes for a play session they own. */
export function guestMayCancelEncoding(search: URLSearchParams, visitorId: string): boolean {
  const id = search.get("playSessionId");
  return Boolean(id && ownsGuestStream(id, visitorId));
}
