import Link from "next/link";
import type { ReactNode } from "react";

/** "// THE LIBRARY" full-width section title with a hairline under it. */
export function SectionHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="rule flex items-end justify-between pb-3">
      <h2 className="label-lg flex items-center gap-4">
        <span className="slash">{"//"}</span>
        {title}
      </h2>
      {aside}
    </div>
  );
}

/** "RECENTLY ADDED →" row title with an optional VIEW ALL link on the right. */
export function RowHeader({
  title,
  href,
  count,
}: {
  title: string;
  href?: string;
  count?: number;
}) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h3 className="label flex items-center gap-3 text-text">
        {href ? (
          <Link href={href} className="flex items-center gap-3 hover:text-accent">
            {title}
            <span aria-hidden className="text-base leading-none">&rarr;</span>
          </Link>
        ) : (
          title
        )}
        {count !== undefined && <span className="text-dim">{count}</span>}
      </h3>
      {href && (
        <Link href={href} className="label text-[0.62rem] text-muted hover:text-text">
          View all
        </Link>
      )}
    </div>
  );
}

/** Horizontal scroller for card rows. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="row-scroll -mx-6 flex gap-5 overflow-x-auto px-6 pb-2 sm:-mx-10 sm:px-10">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="label border border-dashed border-line px-6 py-10 text-center text-dim">{children}</p>;
}
