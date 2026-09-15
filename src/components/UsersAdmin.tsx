"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type UserRow = {
  id: string;
  name: string;
  displayName: string | null;
  isAdmin: boolean;
  isDisabled: boolean;
  isGuest: boolean;
  lastActivity: string | null;
  imageTag: string | null;
};

function ago(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 0)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function UsersAdmin({ users, selfId }: { users: UserRow[]; selfId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not create the user.");
      setNotice(`Created ${name}.`);
      setName("");
      setPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the user.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(user: UserRow) {
    if (!window.confirm(`Delete ${user.name}? Their watch history in Jellyfin goes with them.`)) return;
    setBusy(user.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not delete the user.");
      setNotice(`Deleted ${user.name}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the user.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="label text-text">Users</p>
        <p className="label mt-1 text-[0.62rem] text-dim">Accounts live in Jellyfin. Click a name to edit everything it may do.</p>
        <div className="mt-5 border-t border-line">
          {users.map((user) => (
            <div key={user.id} className="grid grid-cols-[40px_1fr_auto] items-center gap-4 border-b border-line py-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-line bg-panel-2">
                {user.imageTag ? (
                  // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
                  <img src={`/api/jf/UserImage?userId=${user.id}&tag=${user.imageTag}&fillWidth=80&fillHeight=80`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm uppercase text-muted">{user.name.slice(0, 1)}</span>
                )}
              </div>
              <div className="min-w-0">
                <Link href={`/settings/users/${user.id}`} className="label flex flex-wrap items-center gap-3 text-text hover:text-accent">
                  <span className="truncate">{user.displayName ?? user.name}</span>
                  {user.displayName && <span className="text-dim">{user.name}</span>}
                  {user.isAdmin && <span className="text-accent">Admin</span>}
                  {user.isGuest && <span className="text-warn">Guest</span>}
                  {user.isDisabled && <span className="text-dim">Disabled</span>}
                  {user.id === selfId && <span className="text-dim">You</span>}
                </Link>
                <p className="label mt-1 text-[0.62rem] text-muted">Last seen {ago(user.lastActivity)}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/settings/users/${user.id}`} className="btn px-3 py-1.5 text-[0.62rem]">Edit</Link>
                {user.id !== selfId && (
                  <button type="button" onClick={() => remove(user)} disabled={busy !== null} className="btn px-3 py-1.5 text-[0.62rem] text-muted">
                    {busy === user.id ? "Deleting" : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={create} className="max-w-xl space-y-4">
        <p className="label text-text">New user</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Username" aria-label="Username" maxLength={64} required />
          <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+)" aria-label="Password" minLength={8} required autoComplete="new-password" />
        </div>
        {(notice || error) && <p className={`label ${error ? "text-accent" : "text-ok"}`} role="status">{error ?? notice}</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn btn-solid" disabled={busy !== null}>{busy === "create" ? "Creating" : "Create user"}</button>
        </div>
      </form>
    </div>
  );
}
