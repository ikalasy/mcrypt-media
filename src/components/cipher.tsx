"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The "encrypt to binary, decrypt to the next thing" transition used by the
 * featured hero and the screensaver. Text scrambles into 0/1 from left to
 * right, then resolves into the new text the same way. Images get a binary
 * curtain that sweeps across while the picture underneath is swapped.
 */

export const ENCRYPT_MS = 700;
export const DECRYPT_MS = 900;
export const CIPHER_TOTAL_MS = ENCRYPT_MS + DECRYPT_MS;
const FALLBACK_GRACE_MS = 300;

function bit(): string {
  return Math.random() < 0.5 ? "0" : "1";
}

/** Frame of the scramble: `cutoff` chars are binary (encrypt) or resolved (decrypt). */
function frame(source: string, length: number, cutoff: number, mode: "encrypt" | "decrypt"): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const char = source[i] ?? "";
    if (char === " " || char === "\n") {
      out += char;
      continue;
    }
    const scrambled = mode === "encrypt" ? i < cutoff : i >= cutoff;
    out += scrambled ? bit() : char;
  }
  return out;
}

/** Returns the text to render; animates whenever `target` changes. */
export function useCipherText(target: string): { text: string; busy: boolean } {
  const [text, setText] = useState(target);
  const [busy, setBusy] = useState(false);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    const length = Math.max(from.length, target.length);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < ENCRYPT_MS) {
        setBusy(true);
        setText(frame(from, length, Math.floor((elapsed / ENCRYPT_MS) * length), "encrypt"));
      } else if (elapsed < CIPHER_TOTAL_MS) {
        const p = (elapsed - ENCRYPT_MS) / DECRYPT_MS;
        setText(frame(target, target.length, Math.floor(p * target.length), "decrypt"));
      } else {
        shownRef.current = target;
        setText(target);
        setBusy(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Background tabs pause animation frames; make sure the new text still lands.
    const fallback = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      shownRef.current = target;
      setText(target);
      setBusy(false);
    }, CIPHER_TOTAL_MS + FALLBACK_GRACE_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
  }, [target]);

  return { text, busy };
}

export function CipherText({ text, className, as: Tag = "span" }: { text: string; className?: string; as?: "span" | "h1" | "p" }) {
  const { text: shown } = useCipherText(text);
  return <Tag className={className}>{shown}</Tag>;
}

const CURTAIN_ROWS = 28;
const CURTAIN_COLS = 96;

function curtainLines(): string[] {
  return Array.from({ length: CURTAIN_ROWS }, () =>
    Array.from({ length: CURTAIN_COLS }, () => (Math.random() < 0.5 ? "0" : "1")).join(""),
  );
}

type CipherImageProps = { src: string | null; className?: string };

/** Swaps to a new `src` behind a sweeping binary curtain. */
export function CipherImage({ src, className }: CipherImageProps) {
  const [shown, setShown] = useState(src);
  const [sweep, setSweep] = useState<{ phase: "in" | "out"; p: number } | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const shownRef = useRef(src);

  useEffect(() => {
    if (shownRef.current === src) return;
    const start = performance.now();
    let swapped = false;
    let raf = 0;
    setLines(curtainLines());
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < ENCRYPT_MS) {
        setSweep({ phase: "in", p: elapsed / ENCRYPT_MS });
      } else if (elapsed < CIPHER_TOTAL_MS) {
        if (!swapped) {
          swapped = true;
          shownRef.current = src;
          setShown(src);
        }
        setSweep({ phase: "out", p: (elapsed - ENCRYPT_MS) / DECRYPT_MS });
      } else {
        setSweep(null);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const fallback = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      shownRef.current = src;
      setShown(src);
      setSweep(null);
    }, CIPHER_TOTAL_MS + FALLBACK_GRACE_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
  }, [src]);

  const clip = useMemo(() => {
    if (!sweep) return "inset(0 100% 0 0)";
    const pct = Math.round(sweep.p * 100);
    return sweep.phase === "in" ? `inset(0 ${100 - pct}% 0 0)` : `inset(0 0 0 ${pct}%)`;
  }, [sweep]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
        <img src={shown} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="art-empty h-full w-full" />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden bg-black font-mono text-[10px] leading-[1.15] text-accent/80"
        style={{ clipPath: clip, display: sweep ? "block" : "none" }}
      >
        {lines.map((line, i) => (
          <div key={i} className="whitespace-nowrap">{line}</div>
        ))}
      </div>
    </div>
  );
}
