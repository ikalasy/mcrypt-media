"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Props = { next: string; guestEnabled: boolean; contactEmail: string };

/** Split so the address is not sitting in the HTML as one scrapable string. */
function splitEmail(email: string): [string, string] | null {
  const at = email.lastIndexOf("@");
  return at > 0 ? [email.slice(0, at), email.slice(at + 1)] : null;
}

export function LoginForm({ next, guestEnabled, contactEmail }: Props) {
  const contact = splitEmail(contactEmail);
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"login" | "guest" | null>(null);

  async function finish(response: Response) {
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(json.error ?? "Sign in failed.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy("login");
    setError(null);
    try {
      await finish(
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }),
      );
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function asGuest() {
    setBusy("guest");
    setError(null);
    try {
      await finish(await fetch("/api/auth/guest", { method: "POST" }));
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  function openContact() {
    if (!contact) return;
    const subject = encodeURIComponent("Movie Crypted login");
    window.location.href = `mailto:${contact[0]}@${contact[1]}?subject=${subject}`;
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-4">
      <input
        className="field"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        aria-label="Username"
        autoComplete="username"
        autoCapitalize="none"
        maxLength={256}
      />
      <input
        className="field"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        aria-label="Password"
        autoComplete="current-password"
        maxLength={256}
      />
      {contact && (
        <button type="button" onClick={openContact} className="label block text-left text-[0.62rem] text-dim hover:text-accent">
          Forgot password, or think you deserve a login? Contact Kalasy
        </button>
      )}
      {error && (
        <p className="label text-accent" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-solid w-full justify-center" disabled={busy !== null || !username}>
        {busy === "login" ? "Signing in" : "Enter"}
      </button>
      {guestEnabled && (
        <button type="button" onClick={asGuest} className="btn w-full justify-center" disabled={busy !== null}>
          {busy === "guest" ? "One moment" : "Continue as guest"}
        </button>
      )}
    </form>
  );
}
