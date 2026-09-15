"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { provisionedAt: string | null; activeStreams: number };

export function GuestPanel({ provisionedAt, activeStreams }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function provision() {
    const verb = provisionedAt ? "Reset the guest account and rotate its password?" : "Enable public guest access?";
    if (!window.confirm(verb)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/guest", { method: "POST" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Provisioning failed.");
      setIsError(false);
      setMessage(provisionedAt ? "Guest account reset." : "Guest access is live. The login page now offers Continue as guest.");
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Provisioning failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-line bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-text">Public guest access</p>
          <p className="label mt-1 max-w-[60ch] text-[0.62rem] text-dim">
            One shared Jellyfin user named guest. Browsing plus transcoded playback capped at 720p, one stream at a time.
            No requests, profile, notifications, downloads, or writes of any kind.
          </p>
          <p className="label mt-3 text-[0.62rem] text-muted">
            {provisionedAt ? `Enabled ${new Date(provisionedAt).toLocaleString("en-US")}` : "Not enabled"}
            {provisionedAt && ` · ${activeStreams} guest stream${activeStreams === 1 ? "" : "s"} right now`}
          </p>
        </div>
        <button type="button" className={`btn ${provisionedAt ? "" : "btn-solid"}`} disabled={busy} onClick={provision}>
          {busy ? "Working" : provisionedAt ? "Reset guest account" : "Enable guest access"}
        </button>
      </div>
      {message && <p className={`label mt-4 ${isError ? "text-accent" : "text-ok"}`} role="status">{message}</p>}
    </div>
  );
}
