"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CipherImage, CipherText } from "./cipher";

export type FeaturedItem = {
  id: string;
  name: string;
  meta: string;
  overview: string;
  backdrop: string | null;
  playHref: string;
  playLabel: string;
};

export const FEATURED_INTERVAL_MS = 95_000;

type Props = { items: FeaturedItem[]; label?: string; children?: ReactNode };

/** Featured hero that rotates through `items`, encrypting to binary between them. */
export function FeaturedRotator({ items, label = "Featured", children }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % items.length), FEATURED_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [items.length]);

  const item = items[index] ?? items[0];
  if (!item) return null;

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_240px]">
      <Link href={`/item/${item.id}`} className="block aspect-video border border-line bg-panel">
        <CipherImage src={item.backdrop} className="h-full w-full" />
      </Link>

      <div className="flex min-w-0 flex-col justify-center py-2">
        <p className="label flex items-center gap-3 text-text">
          {label}
          <span aria-hidden className="inline-block h-px w-6 bg-accent" />
        </p>
        <CipherText
          as="h1"
          text={item.name}
          className="mt-5 text-3xl font-medium uppercase leading-tight tracking-[0.12em] sm:text-4xl xl:text-5xl"
        />
        <CipherText as="p" text={item.meta} className="label mt-5 text-muted" />
        <CipherText as="p" text={item.overview} className="mt-6 max-w-[52ch] text-[0.8rem] leading-relaxed text-muted" />
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href={item.playHref} className="btn">
            <span aria-hidden>&#9654;</span>
            {item.playLabel}
          </Link>
          <Link href={`/item/${item.id}`} className="btn border-transparent text-muted hover:text-text">
            Details
          </Link>
        </div>
        {items.length > 1 && (
          <div className="mt-6 flex gap-1.5" aria-hidden>
            {items.map((_, i) => (
              <span key={i} className={`h-[2px] w-5 ${i === index ? "bg-accent" : "bg-line-strong"}`} />
            ))}
          </div>
        )}
      </div>

      {children}
    </section>
  );
}
