import { countUnreadForBadge } from "@/lib/notifications";
import { requireSession } from "@/lib/session";
import { TopNav } from "@/components/TopNav";
import { MobileTabs } from "@/components/NavTabs";
import { Screensaver } from "@/components/Screensaver";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const unread = session.isGuest ? 0 : await countUnreadForBadge(session).catch(() => 0);
  return (
    <>
      <TopNav session={session} unread={unread} />
      <MobileTabs />
      <Screensaver />
      <main className="mx-auto w-full max-w-[1700px] flex-1 px-6 py-8 sm:px-10">{children}</main>
      <footer className="mx-auto w-full max-w-[1700px] px-6 py-6 sm:px-10">
        <p className="label text-[0.6rem] text-dim">
          <span className="slash">{"//"}</span> MCrypted &middot; Movie Crypted &middot; private server
        </p>
      </footer>
    </>
  );
}
