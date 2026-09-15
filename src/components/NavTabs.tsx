"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; match: (path: string) => boolean };

const TABS: Tab[] = [
  {
    href: "/",
    label: "Library",
    match: (p) => p === "/" || p.startsWith("/library") || p.startsWith("/item") || p.startsWith("/watch"),
  },
  { href: "/collections", label: "Collections", match: (p) => p.startsWith("/collections") },
  { href: "/search", label: "Search", match: (p) => p.startsWith("/search") },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="hidden h-full items-stretch gap-10 justify-self-center md:flex" aria-label="Primary">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`label relative flex items-center transition-colors ${
              active ? "text-text" : "text-muted hover:text-text"
            }`}
          >
            {tab.label}
            <span
              aria-hidden
              className={`absolute inset-x-0 -bottom-[21px] h-[2px] ${active ? "bg-accent" : "bg-transparent"}`}
            />
          </Link>
        );
      })}
    </nav>
  );
}

/** Compact version for small screens, rendered under the header. */
export function MobileTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-6 overflow-x-auto border-b border-line px-6 py-3 md:hidden row-scroll" aria-label="Primary">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`label whitespace-nowrap ${active ? "text-text border-b-2 border-accent pb-1" : "text-muted"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
