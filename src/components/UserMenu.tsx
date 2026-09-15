"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = { name: string; isAdmin: boolean; unread?: number; avatarUrl?: string | null };

export function UserMenu({ name, isAdmin, unread = 0, avatarUrl = null }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const item = "label block px-3 py-2 text-muted hover:bg-panel-2 hover:text-text";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="relative"
        title={name}
      >
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-panel-2 transition-colors hover:border-accent">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs uppercase text-text">{name.slice(0, 1)}</span>
          )}
        </span>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-accent" aria-label={`${unread} unread notifications`} />
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 w-60 border border-line bg-panel py-2 shadow-2xl">
          <div className="px-3 pb-2">
            <p className="label text-dim">Signed in as</p>
            <p className="mt-1 truncate text-sm uppercase tracking-wider">{name}</p>
            {isAdmin && <p className="label mt-1 text-accent">Admin</p>}
          </div>
          <div className="border-t border-line py-1">
            <Link href="/settings/profile" role="menuitem" className={item} onClick={() => setOpen(false)}>Profile</Link>
            <Link href="/settings/display" role="menuitem" className={item} onClick={() => setOpen(false)}>Display</Link>
            <Link href="/settings/notifications" role="menuitem" className={`${item} flex items-center justify-between`} onClick={() => setOpen(false)}>
              Notifications
              {unread > 0 && <span className="text-accent">{unread}</span>}
            </Link>
            {isAdmin && (
              <>
                <Link href="/settings/users" role="menuitem" className={item} onClick={() => setOpen(false)}>Users</Link>
                <Link href="/settings/server" role="menuitem" className={item} onClick={() => setOpen(false)}>Server</Link>
              </>
            )}
          </div>
          <div className="border-t border-line px-3 pt-2">
            <button type="button" role="menuitem" onClick={logout} disabled={busy} className="btn w-full justify-center py-2 text-[0.65rem]">
              {busy ? "Signing out" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
