import Link from "next/link";
import { getMe, pingServer } from "@/lib/jellyfin";
import type { Session } from "@/lib/session";
import { NavTabs } from "./NavTabs";
import { UserMenu } from "./UserMenu";

const PING_TIMEOUT_MS = 1_500;

async function isOnline(): Promise<boolean> {
  try {
    await Promise.race([
      pingServer(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), PING_TIMEOUT_MS)),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function avatarFor(session: Session): Promise<string | null> {
  if (session.isGuest) return null;
  const me = await getMe(session).catch(() => null);
  if (!me?.PrimaryImageTag) return null;
  return `/api/jf/UserImage?userId=${session.userId}&tag=${me.PrimaryImageTag}&fillWidth=64&fillHeight=64&quality=90`;
}

export async function TopNav({ session, unread = 0 }: { session: Session; unread?: number }) {
  const [online, avatarUrl] = await Promise.all([isOnline(), avatarFor(session)]);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-[1700px] grid-cols-[1fr_auto_1fr] items-center px-6 sm:px-10">
        <Link href="/" className="flex items-center gap-4 justify-self-start" aria-label="Movie Crypted home">
          <span className="slash text-2xl leading-none">{"//"}</span>
          <span className="label-lg font-medium tracking-[0.3em]">Movie Crypted</span>
        </Link>

        <NavTabs />

        <div className="flex items-center gap-5 justify-self-end">
          <span className="label hidden items-center gap-2 sm:flex" title="Media server reachability">
            <span
              className={`inline-block h-2 w-2 rounded-full ${online ? "bg-ok" : "bg-accent"}`}
              aria-hidden
            />
            {online ? "Online" : "Offline"}
          </span>
          <Link href="/search" aria-label="Search" className="text-muted hover:text-text">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </Link>
          {session.isGuest ? (
            <Link href="/login?reason=member" className="label flex items-center gap-2 text-muted hover:text-text">
              <span className="text-dim">Guest</span>
              <span className="border border-line px-2 py-1 hover:border-accent">Sign in</span>
            </Link>
          ) : (
            <UserMenu name={session.userName} isAdmin={session.isAdmin} unread={unread} avatarUrl={avatarUrl} />
          )}
        </div>
      </div>
    </header>
  );
}
