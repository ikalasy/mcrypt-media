"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CipherImage, CipherText } from "./cipher";

const IDLE_MS = 5 * 60 * 1000;
/** Dev-only shortcut: append ?screensaver=1 to trigger it after a few seconds. */
const DEV_IDLE_MS = 3_000;
const ROTATE_MS = 95_000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"] as const;

type Item = { id: string; name: string; meta: string; backdrop: string };

function useClock(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return {
    time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase(),
  };
}

function videoIsPlaying(): boolean {
  return [...document.querySelectorAll("video")].some((v) => !v.paused && !v.ended);
}

/** Full-screen idle screen: rotating backdrops with the binary transition, clock, and title. */
export function Screensaver() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const timer = useRef<number | null>(null);

  /* Idle detection. */
  useEffect(() => {
    if (pathname.startsWith("/watch")) return;
    const arm = () => {
      if (timer.current) window.clearTimeout(timer.current);
      const quick = process.env.NODE_ENV !== "production" && window.location.search.includes("screensaver=1");
      timer.current = window.setTimeout(() => {
        if (!videoIsPlaying()) setActive(true);
        else arm();
      }, quick ? DEV_IDLE_MS : IDLE_MS);
    };
    const onActivity = () => {
      setActive(false);
      arm();
    };
    arm();
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true });
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
    };
  }, [pathname]);

  /* Load the backdrop pool when the screen turns on. */
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch("/api/screensaver")
      .then(async (r) => ((await r.json()) as { items: Item[] }).items ?? [])
      .then((list) => {
        if (!cancelled && list.length) {
          setItems(list);
          setIndex(0);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active]);

  /* Rotate. */
  useEffect(() => {
    if (!active || items.length < 2) return;
    const rotate = window.setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => window.clearInterval(rotate);
  }, [active, items.length]);

  if (!active) return null;
  return <ScreensaverView item={items[index]} />;
}

function ScreensaverView({ item }: { item?: Item }) {
  const { time, date } = useClock();
  return (
    <div className="fixed inset-0 z-[70] cursor-none bg-black text-white" aria-label="Screensaver" role="presentation">
      <CipherImage src={item?.backdrop ?? null} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/60" />

      <div className="absolute left-10 top-8 flex items-center gap-4">
        <span className="slash text-3xl leading-none">{"//"}</span>
        <span className="label-lg tracking-[0.3em] text-white">Movie Crypted</span>
      </div>

      <div className="absolute right-10 top-8 text-right">
        <p className="text-2xl tracking-[0.12em]">{time}</p>
        <p className="label mt-1 text-white/60">{date}</p>
      </div>

      <div className="absolute bottom-10 left-10 flex items-center gap-4">
        <span className="slash text-2xl leading-none">{"//"}</span>
        <span className="text-[0.95rem] tracking-[0.08em] text-white/80">Stay MCrypted..</span>
      </div>

      {item && (
        <div className="absolute bottom-10 right-10 max-w-[40vw] border-l-2 border-accent pl-5 text-left">
          <CipherText as="p" text={item.name} className="text-2xl uppercase tracking-[0.12em] sm:text-3xl" />
          <CipherText as="p" text={item.meta} className="label mt-2 text-white/60" />
        </div>
      )}
    </div>
  );
}
