"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

const DISPLAY_NAME_MAX = 32;
const BIO_MAX = 160;
const MAX_UPLOAD = 10 * 1024 * 1024;

type Props = {
  userId: string;
  userName: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  imageTag: string | null;
};

export function ProfileForm(props: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(props.displayName);
  const [bio, setBio] = useState(props.bio);
  const [avatar, setAvatar] = useState(props.avatarUrl);
  const [busy, setBusy] = useState<"save" | "upload" | "remove" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = displayName !== props.displayName || bio !== props.bio;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Save failed.");
      setNotice("Saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD) {
      setError("That image is over 10 MB.");
      return;
    }
    setBusy("upload");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Upload failed.");
      setAvatar((previous) => {
        if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
        return URL.createObjectURL(file);
      });
      setNotice("Picture updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove the picture.");
      setAvatar(null);
      setNotice("Picture removed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the picture.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} className="max-w-xl space-y-8">
      <div>
        <p className="label mb-3 text-text">Profile picture</p>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-accent bg-panel-2">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- proxied Jellyfin artwork
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl uppercase text-muted">{props.userName.slice(0, 1)}</span>
            )}
          </div>
          <div className="space-y-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
                {busy === "upload" ? "Uploading" : "Change photo"}
              </button>
              {avatar && (
                <button type="button" className="btn border-transparent text-muted" disabled={busy !== null} onClick={remove}>
                  {busy === "remove" ? "Removing" : "Remove"}
                </button>
              )}
            </div>
            <p className="label text-[0.62rem] text-dim">JPG, PNG or WEBP &middot; Max 10 MB</p>
          </div>
        </div>
      </div>

      <div>
        <label className="label mb-3 block text-text" htmlFor="displayName">Display name</label>
        <input
          id="displayName"
          className="field"
          value={displayName}
          maxLength={DISPLAY_NAME_MAX}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={props.userName}
        />
        <p className="label mt-2 text-right text-[0.62rem] text-dim">{displayName.length}/{DISPLAY_NAME_MAX}</p>
        <p className="label text-[0.62rem] text-dim">Your login stays <span className="text-muted">{props.userName}</span>. This is what others see.</p>
      </div>

      <div>
        <label className="label mb-3 block text-text" htmlFor="bio">Bio <span className="text-dim">(optional)</span></label>
        <textarea
          id="bio"
          className="field min-h-24 resize-y"
          value={bio}
          maxLength={BIO_MAX}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Movie nights hit different."
        />
        <p className="label mt-2 text-right text-[0.62rem] text-dim">{bio.length}/{BIO_MAX}</p>
      </div>

      {(notice || error) && (
        <p className={`label ${error ? "text-accent" : "text-ok"}`} role="status">{error ?? notice}</p>
      )}

      <div className="flex justify-end gap-3 border-t border-line pt-6">
        <button
          type="button"
          className="btn"
          disabled={!dirty || busy !== null}
          onClick={() => {
            setDisplayName(props.displayName);
            setBio(props.bio);
          }}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-solid" disabled={!dirty || busy !== null}>
          {busy === "save" ? "Saving" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
