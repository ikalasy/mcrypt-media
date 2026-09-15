import Link from "next/link";
import { requireMember } from "@/lib/session";
import { SettingsSidebar } from "@/components/SettingsSidebar";

/** The Edit Profile panel from the mockup: sidebar on the left, content on the right. */
export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const session = await requireMember();
  return (
    <div className="mx-auto max-w-[1200px] border border-line bg-panel shadow-2xl">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <p className="label-lg flex items-center gap-4">
          <span className="slash">{"//"}</span>
          Settings
          <span aria-hidden className="inline-block h-px w-6 bg-accent" />
        </p>
        <Link href="/" aria-label="Close settings" className="text-muted hover:text-text">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
      <div className="grid md:grid-cols-[240px_1fr]">
        <SettingsSidebar isAdmin={session.isAdmin} userName={session.userName} />
        <section className="min-w-0 border-t border-line p-6 md:border-l md:border-t-0 md:p-8">{children}</section>
      </div>
    </div>
  );
}
