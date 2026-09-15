"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Apply or restore the MCrypted custom CSS inside the stock Jellyfin web client. */
export function JellyfinThemePanel({ applied, jellyfinUrl }: { applied: boolean; jellyfinUrl: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function run(action: "apply" | "restore") {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/jellyfin-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await response.json()) as { error?: string; applied?: boolean };
      if (!response.ok) throw new Error(json.error ?? "Update failed.");
      setIsError(false);
      setMessage(
        action === "apply"
          ? "Theme applied. Hard-refresh the Jellyfin web client (Ctrl+F5) to see it."
          : "Previous custom CSS restored.",
      );
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-line bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-text">Jellyfin web theme</p>
          <p className="label mt-1 max-w-[60ch] text-[0.62rem] text-dim">
            Writes the MCrypted custom CSS into Jellyfin&apos;s branding settings so the stock client and TV apps that
            use it match this site. Restore puts back whatever CSS was there before.
          </p>
          <p className="label mt-3 text-[0.62rem] text-muted">
            {applied ? "Applied" : "Not applied"} &middot;{" "}
            <a href={jellyfinUrl} target="_blank" rel="noreferrer" className="hover:text-accent">
              open Jellyfin
            </a>
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" className={`btn ${applied ? "" : "btn-solid"}`} disabled={busy} onClick={() => run("apply")}>
            {busy ? "Working" : applied ? "Re-apply" : "Apply theme"}
          </button>
          {applied && (
            <button type="button" className="btn" disabled={busy} onClick={() => run("restore")}>
              Restore
            </button>
          )}
        </div>
      </div>
      {message && <p className={`label mt-4 ${isError ? "text-accent" : "text-ok"}`} role="status">{message}</p>}
    </div>
  );
}
