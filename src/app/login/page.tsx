import { LoginForm } from "@/components/LoginForm";
import { getEnv } from "@/lib/env";
import { guestInfo } from "@/lib/guest";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  member: "That part of the site needs a real account. Sign in, or ask for one below.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { next, reason } = await searchParams;
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const guestEnabled = (await guestInfo().catch(() => null)) !== null;
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="flex items-center gap-4">
          <span className="slash text-3xl leading-none">{"//"}</span>
          <span className="label-lg tracking-[0.3em]">Movie Crypted</span>
        </p>
        <p className="label mt-3 text-dim">MCrypted. Private server. Sign in or continue as a guest.</p>
        {reason && REASONS[reason] && (
          <p className="label mt-6 border border-line bg-panel px-4 py-3 text-muted" role="status">
            {REASONS[reason]}
          </p>
        )}
        <LoginForm next={target} guestEnabled={guestEnabled} contactEmail={getEnv().contactEmail} />
      </div>
    </main>
  );
}
