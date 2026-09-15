"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PolicyField, PolicyGroup } from "@/lib/users";

type Policy = Record<string, unknown>;
type Folder = { id: string; name: string };

type Props = {
  userId: string;
  isSelf: boolean;
  policy: Policy;
  groups: PolicyGroup[];
  folders: Folder[];
};

const PASSWORD_MIN = 8;

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function Field({ field, value, onChange, folders }: { field: PolicyField; value: unknown; onChange: (v: unknown) => void; folders: Folder[] }) {
  const id = `policy-${field.key}`;
  switch (field.kind) {
    case "boolean":
      return (
        <label htmlFor={id} className="flex items-center justify-between gap-4 border-b border-line py-3">
          <span>
            <span className="label block text-text">{field.label}</span>
            {field.hint && <span className="label mt-1 block text-[0.62rem] text-dim">{field.hint}</span>}
          </span>
          <input id={id} type="checkbox" className="switch" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        </label>
      );
    case "number":
      return (
        <label htmlFor={id} className="grid gap-2 border-b border-line py-3 sm:grid-cols-[1fr_160px] sm:items-center">
          <span>
            <span className="label block text-text">{field.label}</span>
            {field.hint && <span className="label mt-1 block text-[0.62rem] text-dim">{field.hint}</span>}
          </span>
          <input
            id={id}
            type="number"
            className="field py-2"
            min={field.min}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
        </label>
      );
    case "select":
      return (
        <label htmlFor={id} className="grid gap-2 border-b border-line py-3 sm:grid-cols-[1fr_220px] sm:items-center">
          <span className="label text-text">{field.label}</span>
          <select id={id} className="field py-2" value={String(value ?? field.options[0])} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      );
    case "strings":
      return (
        <label htmlFor={id} className="grid gap-2 border-b border-line py-3">
          <span>
            <span className="label block text-text">{field.label}</span>
            {field.hint && <span className="label mt-1 block text-[0.62rem] text-dim">{field.hint}</span>}
          </span>
          <input
            id={id}
            className="field py-2"
            value={asStrings(value).join(", ")}
            onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
          />
        </label>
      );
    case "folders": {
      const selected = new Set(asStrings(value));
      return (
        <div className="border-b border-line py-3">
          <p className="label text-text">{field.label}</p>
          {field.hint && <p className="label mt-1 text-[0.62rem] text-dim">{field.hint}</p>}
          <div className="mt-3 flex flex-wrap gap-4">
            {folders.length === 0 && <span className="label text-dim">No libraries found.</span>}
            {folders.map((folder) => (
              <label key={folder.id} className="label flex items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  className="switch"
                  checked={selected.has(folder.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(folder.id);
                    else next.delete(folder.id);
                    onChange([...next]);
                  }}
                />
                {folder.name}
              </label>
            ))}
          </div>
        </div>
      );
    }
    case "json":
      return (
        <label htmlFor={id} className="grid gap-2 border-b border-line py-3">
          <span>
            <span className="label block text-text">{field.label}</span>
            {field.hint && <span className="label mt-1 block text-[0.62rem] text-dim">{field.hint}</span>}
          </span>
          <textarea
            id={id}
            className="field min-h-20 font-mono text-[0.75rem]"
            defaultValue={JSON.stringify(value ?? [], null, 0)}
            onBlur={(e) => {
              try {
                onChange(JSON.parse(e.target.value || "[]"));
                e.target.setCustomValidity("");
              } catch {
                e.target.setCustomValidity("Not valid JSON");
                e.target.reportValidity();
              }
            }}
          />
        </label>
      );
  }
}

export function PolicyEditor({ userId, isSelf, policy: initial, groups, folders }: Props) {
  const router = useRouter();
  const [policy, setPolicy] = useState<Policy>(initial);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"policy" | "password" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(policy) !== JSON.stringify(initial);

  async function savePolicy(event: FormEvent) {
    event.preventDefault();
    setBusy("policy");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Save failed.");
      setNotice("Policy saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setBusy("password");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not set the password.");
      setNotice("Password updated.");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set the password.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      <form onSubmit={savePolicy} className="space-y-8">
        {groups.map((group) => (
          <fieldset key={group.title}>
            <legend className="label mb-2 text-accent">{group.title}</legend>
            {group.fields.map((field) => (
              <Field
                key={field.key}
                field={field}
                value={policy[field.key]}
                folders={folders}
                onChange={(v) => setPolicy((prev) => ({ ...prev, [field.key]: v }))}
              />
            ))}
          </fieldset>
        ))}
        {isSelf && <p className="label text-[0.62rem] text-dim">You cannot remove your own admin role or disable yourself.</p>}
        {(notice || error) && <p className={`label ${error ? "text-accent" : "text-ok"}`} role="status">{error ?? notice}</p>}
        <div className="flex justify-end gap-3 border-t border-line pt-6">
          <button type="button" className="btn" disabled={!dirty || busy !== null} onClick={() => setPolicy(initial)}>Cancel</button>
          <button type="submit" className="btn btn-solid" disabled={!dirty || busy !== null}>{busy === "policy" ? "Saving" : "Save policy"}</button>
        </div>
      </form>

      <form onSubmit={resetPassword} className="max-w-md space-y-3">
        <p className="label text-text">Set a new password</p>
        <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${PASSWORD_MIN} characters`} minLength={PASSWORD_MIN} required autoComplete="new-password" aria-label="New password" />
        <div className="flex justify-end">
          <button type="submit" className="btn" disabled={busy !== null || password.length < PASSWORD_MIN}>{busy === "password" ? "Saving" : "Update password"}</button>
        </div>
      </form>
    </div>
  );
}
