"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/", label: "Home", icon: "M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" },
  { href: "/settings/profile", label: "Profile", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0" },
  { href: "/settings/display", label: "Display", icon: "M3 5h18v12H3zM8 21h8M12 17v4" },
  { href: "/settings/notifications", label: "Notifications", icon: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" },
  { href: "/settings/users", label: "Users", icon: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.6", adminOnly: true },
  { href: "/settings/server", label: "Server", icon: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01", adminOnly: true },
];

export function SettingsSidebar({ isAdmin, userName }: { isAdmin: boolean; userName: string }) {
  const pathname = usePathname();
  return (
    <aside className="py-4">
      <div className="mb-4 px-5">
        <p className="label text-dim">Signed in as</p>
        <p className="mt-1 truncate text-sm uppercase tracking-wider">{userName}</p>
      </div>
      <nav aria-label="Settings">
        {ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const active = item.href !== "/" && pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className="side-item" aria-current={active ? "page" : undefined}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
