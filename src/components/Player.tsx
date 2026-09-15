"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildDeviceProfile } from "@/lib/device-profile";
import { PROXY_BASE } from "@/lib/images";
import { secondsToTicks, ticksToSeconds } from "@/lib/format";
import type { MediaSource, MediaStream, PlaybackInfoResponse } from "@/lib/types";

const PROGRESS_INTERVAL_MS = 10_000;

export type PlayerProps = {
  itemId: string;
  userId: string;
  deviceId: string;
  title: string;
  subtitle?: string;
  startTicks: number;
  backHref: string;
  nextHref?: string;
};

type PlayMethod = "DirectPlay" | "Transcode";

type Plan = {
  source: MediaSource;
  playSessionId: string;
  method: PlayMethod;
  url: string;
  /** Ticks the stream starts at; HLS transcodes begin at the resume point. */
  offsetTicks: number;
  subtitles: MediaStream[];
};

async function proxyPost(path: string, body: unknown, keepalive = false): Promise<Response> {
  return fetch(`${PROXY_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  });
}

function choosePlan(info: PlaybackInfoResponse, itemId: string, startTicks: number): Plan {
  const source = info.MediaSources?.[0];
  if (!source) throw new Error("No playable media source.");
  const subtitles = (source.MediaStreams ?? []).filter(
    (s) => s.Type === "Subtitle" && s.DeliveryMethod === "External" && s.DeliveryUrl,
  );
  if (source.SupportsDirectPlay) {
    const params = new URLSearchParams({
      static: "true",
      mediaSourceId: source.Id,
      playSessionId: info.PlaySessionId,
    });
    return {
      source,
      playSessionId: info.PlaySessionId,
      method: "DirectPlay",
      url: `${PROXY_BASE}/Videos/${itemId}/stream?${params.toString()}`,
      offsetTicks: 0,
      subtitles,
    };
  }
  if (source.TranscodingUrl) {
    return {
      source,
      playSessionId: info.PlaySessionId,
      method: "Transcode",
      url: `${PROXY_BASE}${source.TranscodingUrl}`,
      offsetTicks: startTicks,
      subtitles,
    };
  }
  throw new Error(info.ErrorCode ? `Server refused playback: ${info.ErrorCode}` : "This file cannot be played in a browser.");
}

export function Player(props: PlayerProps) {
  const { itemId, userId, deviceId, title, subtitle, startTicks, backHref, nextHref } = props;
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const planRef = useRef<Plan | null>(null);
  const stoppedRef = useRef(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChrome, setShowChrome] = useState(true);

  const positionTicks = useCallback((): number => {
    const video = videoRef.current;
    const current = planRef.current;
    if (!video || !current) return 0;
    return current.offsetTicks + secondsToTicks(video.currentTime);
  }, []);

  const report = useCallback(
    (kind: "start" | "progress" | "stop", keepalive = false) => {
      const current = planRef.current;
      const video = videoRef.current;
      if (!current || !video) return;
      const body = {
        ItemId: itemId,
        MediaSourceId: current.source.Id,
        PlaySessionId: current.playSessionId,
        PositionTicks: positionTicks(),
        IsPaused: video.paused,
        IsMuted: video.muted,
        VolumeLevel: Math.round(video.volume * 100),
        CanSeek: true,
        PlayMethod: current.method,
        RepeatMode: "RepeatNone",
      };
      const path = kind === "start" ? "Sessions/Playing" : kind === "progress" ? "Sessions/Playing/Progress" : "Sessions/Playing/Stopped";
      void proxyPost(path, body, keepalive).catch(() => undefined);
    },
    [itemId, positionTicks],
  );

  const stop = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    report("stop", true);
    const current = planRef.current;
    if (current?.method === "Transcode") {
      const params = new URLSearchParams({ deviceId, playSessionId: current.playSessionId });
      void fetch(`${PROXY_BASE}/Videos/ActiveEncodings?${params.toString()}`, { method: "DELETE", keepalive: true }).catch(
        () => undefined,
      );
    }
  }, [deviceId, report]);

  /* Negotiate playback with Jellyfin once. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          userId,
          startTimeTicks: String(startTicks),
          autoOpenLiveStream: "false",
          maxStreamingBitrate: "120000000",
        });
        const response = await proxyPost(`Items/${itemId}/PlaybackInfo?${params.toString()}`, {
          DeviceProfile: buildDeviceProfile(),
        });
        if (!response.ok) throw new Error(`PlaybackInfo failed (${response.status}).`);
        const info = (await response.json()) as PlaybackInfoResponse;
        if (cancelled) return;
        const chosen = choosePlan(info, itemId, startTicks);
        planRef.current = chosen;
        setPlan(chosen);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Playback failed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, userId, startTicks]);

  /* Attach the media source once we have a plan. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !plan) return;
    let hls: import("hls.js").default | null = null;
    let disposed = false;

    const onLoaded = () => {
      if (plan.method === "DirectPlay" && startTicks > 0) {
        video.currentTime = ticksToSeconds(startTicks);
      }
      void video.play().catch(() => undefined);
      report("start");
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });

    (async () => {
      if (plan.method === "DirectPlay" || video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = plan.url;
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (disposed) return;
      if (!Hls.isSupported()) {
        setError("This browser cannot play HLS streams.");
        return;
      }
      hls = new Hls({ maxBufferLength: 30, backBufferLength: 60 });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError(`Stream error: ${data.details}`);
      });
      hls.loadSource(plan.url);
      hls.attachMedia(video);
    })();

    const interval = window.setInterval(() => {
      if (!video.paused && !video.ended) report("progress");
    }, PROGRESS_INTERVAL_MS);
    const onPause = () => report("progress");
    const onPlay = () => report("progress");
    const onSeeked = () => report("progress");
    const onEnded = () => {
      stop();
      router.push(nextHref ?? backHref);
    };
    const onUnload = () => stop();
    video.addEventListener("pause", onPause);
    video.addEventListener("play", onPlay);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ended", onEnded);
    window.addEventListener("pagehide", onUnload);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ended", onEnded);
      window.removeEventListener("pagehide", onUnload);
      stop();
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [plan, startTicks, report, stop, router, nextHref, backHref]);

  /* Hide the title bar while the mouse is still. */
  useEffect(() => {
    let timer = window.setTimeout(() => setShowChrome(false), 3000);
    const onMove = () => {
      setShowChrome(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShowChrome(false), 3000);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video ref={videoRef} className="h-full w-full" controls playsInline crossOrigin="use-credentials">
        {plan?.subtitles.map((track, index) => (
          <track
            key={track.Index}
            kind="subtitles"
            src={`${PROXY_BASE}${track.DeliveryUrl}`}
            srcLang={track.Language ?? "und"}
            label={track.DisplayTitle ?? track.Title ?? `Subtitle ${index + 1}`}
            default={track.Index === plan.source.DefaultSubtitleStreamIndex}
          />
        ))}
      </video>

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent p-6 transition-opacity ${showChrome ? "opacity-100" : "opacity-0"}`}
      >
        <Link href={backHref} className="pointer-events-auto label flex items-center gap-3 text-text hover:text-accent">
          <span aria-hidden>&larr;</span> Back
        </Link>
        <div className="text-right">
          <p className="label text-text">{title}</p>
          {subtitle && <p className="label mt-1 text-[0.62rem] text-muted">{subtitle}</p>}
          {plan && (
            <p className="label mt-2 text-[0.6rem] text-dim">
              {plan.method === "DirectPlay" ? "Direct play" : "Transcoding"} &middot; {plan.source.Container?.toUpperCase()}
            </p>
          )}
        </div>
      </div>

      {!plan && !error && (
        <p className="label absolute inset-x-0 top-1/2 text-center text-muted">Negotiating stream&hellip;</p>
      )}
      {error && (
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-4 px-6 text-center">
          <p className="label text-accent">Playback failed</p>
          <p className="max-w-[60ch] text-[0.8rem] text-muted">{error}</p>
          <Link href={backHref} className="btn">Back</Link>
        </div>
      )}
    </div>
  );
}
