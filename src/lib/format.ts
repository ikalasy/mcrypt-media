/** Pure formatting helpers shared by server and client components. */

export const TICKS_PER_SECOND = 10_000_000;

export function ticksToSeconds(ticks?: number): number {
  return ticks ? ticks / TICKS_PER_SECOND : 0;
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICKS_PER_SECOND);
}

/** "2H 44M" style runtime, matching the mockup. */
export function formatRuntime(ticks?: number): string {
  const totalMinutes = Math.round(ticksToSeconds(ticks) / 60);
  if (!totalMinutes) return "";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours
    ? `${hours}H ${minutes.toString().padStart(2, "0")}M`
    : `${minutes}M`;
}

/** "1:42:17" style clock for progress readouts. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const mm = minutes.toString().padStart(hours ? 2 : 1, "0");
  const ss = secs.toString().padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const digits = value >= 100 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[exponent]}`;
}

export function formatCount(value?: number): string {
  return (value ?? 0).toLocaleString("en-US");
}

/** Uptime like "47D" or "6H 12M". */
export function formatUptime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  if (days >= 1) return `${days}D`;
  const hours = Math.floor(minutes / 60);
  return `${hours}H ${(minutes % 60).toString().padStart(2, "0")}M`;
}

/** "S1:E3" for episodes. */
export function episodeCode(parentIndex?: number, index?: number): string {
  const season = parentIndex !== undefined ? `S${parentIndex}` : "";
  const episode = index !== undefined ? `E${index}` : "";
  return [season, episode].filter(Boolean).join(":");
}

export function playedPercent(
  positionTicks?: number,
  runtimeTicks?: number,
): number {
  if (!positionTicks || !runtimeTicks) return 0;
  return Math.min(100, Math.max(0, (positionTicks / runtimeTicks) * 100));
}

/** Resolution label like "4K HDR" or "1080P" from a video stream. */
export function qualityLabel(
  width?: number,
  height?: number,
  videoRange?: string,
): string {
  if (!width && !height) return "";
  const w = width ?? 0;
  const h = height ?? 0;
  let label: string;
  if (w >= 3800 || h >= 2100) label = "4K";
  else if (w >= 1900 || h >= 1000) label = "1080P";
  else if (w >= 1260 || h >= 700) label = "720P";
  else label = "SD";
  const isHdr = videoRange && videoRange.toUpperCase() !== "SDR";
  return isHdr ? `${label} HDR` : label;
}
