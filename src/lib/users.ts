import "server-only";
import { jf } from "./jellyfin";
import type { Session } from "./session";

/** Admin-only user management through Jellyfin's API, always with the admin's own token. */

export type UserPolicy = Record<string, unknown> & {
  IsAdministrator?: boolean;
  IsHidden?: boolean;
  IsDisabled?: boolean;
  MaxActiveSessions?: number;
  EnabledFolders?: string[];
  EnableAllFolders?: boolean;
};

export type ManagedUser = {
  Id: string;
  Name: string;
  PrimaryImageTag?: string;
  HasPassword?: boolean;
  LastLoginDate?: string;
  LastActivityDate?: string;
  Policy?: UserPolicy;
};

export type VirtualFolder = { Name: string; ItemId: string; CollectionType?: string; Locations?: string[] };

function auth(session: Session) {
  return { token: session.token, deviceId: session.deviceId };
}

export function listUsers(session: Session): Promise<ManagedUser[]> {
  return jf<ManagedUser[]>("Users", auth(session));
}

export function getUser(session: Session, userId: string): Promise<ManagedUser> {
  return jf<ManagedUser>(`Users/${encodeURIComponent(userId)}`, auth(session));
}

export function createUser(session: Session, name: string, password: string): Promise<ManagedUser> {
  return jf<ManagedUser>("Users/New", { ...auth(session), method: "POST", body: { Name: name, Password: password } });
}

export function deleteUser(session: Session, userId: string): Promise<void> {
  return jf<void>(`Users/${encodeURIComponent(userId)}`, { ...auth(session), method: "DELETE" });
}

/**
 * Replace policy fields, keeping whatever Jellyfin already has for the rest.
 * Jellyfin requires AuthenticationProviderId and PasswordResetProviderId on every
 * policy write, so a partial policy on its own is rejected with 400.
 */
export async function setUserPolicy(session: Session, userId: string, policy: UserPolicy): Promise<void> {
  const current = (await getUser(session, userId)).Policy ?? {};
  const merged: UserPolicy = { ...current, ...policy };
  for (const key of POLICY_READONLY_KEYS) {
    if (current[key] !== undefined) merged[key] = current[key];
  }
  await jf<void>(`Users/${encodeURIComponent(userId)}/Policy`, { ...auth(session), method: "POST", body: merged });
}

/** Admin password reset: no current password needed. */
export function setUserPassword(session: Session, userId: string, newPassword: string): Promise<void> {
  return jf<void>("Users/Password", {
    ...auth(session),
    method: "POST",
    query: { userId },
    body: { NewPw: newPassword },
  });
}

/** A user changing their own password must supply the current one. */
export function changeOwnPassword(session: Session, currentPassword: string, newPassword: string): Promise<void> {
  return jf<void>("Users/Password", {
    ...auth(session),
    method: "POST",
    query: { userId: session.userId },
    body: { CurrentPw: currentPassword, NewPw: newPassword },
  });
}

export function listVirtualFolders(session: Session): Promise<VirtualFolder[]> {
  return jf<VirtualFolder[]>("Library/VirtualFolders", auth(session));
}

/* ---------- Policy editor field catalogue (Jellyfin 12 UserPolicy) ---------- */

export type PolicyField =
  | { key: string; label: string; kind: "boolean"; hint?: string }
  | { key: string; label: string; kind: "number"; hint?: string; min?: number }
  | { key: string; label: string; kind: "strings"; hint?: string }
  | { key: string; label: string; kind: "folders"; hint?: string }
  | { key: string; label: string; kind: "select"; options: string[]; hint?: string }
  | { key: string; label: string; kind: "json"; hint?: string };

export type PolicyGroup = { title: string; fields: PolicyField[] };

export const POLICY_GROUPS: PolicyGroup[] = [
  {
    title: "Account",
    fields: [
      { key: "IsAdministrator", label: "Administrator", kind: "boolean", hint: "Full control of Jellyfin and this app." },
      { key: "IsDisabled", label: "Disabled", kind: "boolean", hint: "Blocks sign-in without deleting the account." },
      { key: "IsHidden", label: "Hidden from login screens", kind: "boolean" },
      { key: "LoginAttemptsBeforeLockout", label: "Login attempts before lockout", kind: "number", hint: "-1 for Jellyfin's default." },
      { key: "MaxActiveSessions", label: "Max simultaneous streams", kind: "number", hint: "0 means unlimited.", min: 0 },
      { key: "EnableUserPreferenceAccess", label: "Can edit own preferences", kind: "boolean" },
      { key: "EnableRemoteAccess", label: "Remote access", kind: "boolean", hint: "Must stay on: this app reaches Jellyfin over the LAN as a client." },
      { key: "EnablePublicSharing", label: "Public sharing", kind: "boolean" },
    ],
  },
  {
    title: "Playback",
    fields: [
      { key: "EnableMediaPlayback", label: "Media playback", kind: "boolean" },
      { key: "EnableVideoPlaybackTranscoding", label: "Video transcoding", kind: "boolean" },
      { key: "EnableAudioPlaybackTranscoding", label: "Audio transcoding", kind: "boolean" },
      { key: "EnablePlaybackRemuxing", label: "Remuxing", kind: "boolean" },
      { key: "ForceRemoteSourceTranscoding", label: "Force transcoding of remote sources", kind: "boolean" },
      { key: "RemoteClientBitrateLimit", label: "Remote bitrate limit (bps)", kind: "number", hint: "0 means unlimited.", min: 0 },
      { key: "EnableContentDownloading", label: "Downloads", kind: "boolean" },
      { key: "EnableSyncTranscoding", label: "Sync transcoding", kind: "boolean" },
      { key: "EnableMediaConversion", label: "Media conversion", kind: "boolean" },
      { key: "SyncPlayAccess", label: "SyncPlay", kind: "select", options: ["CreateAndJoinGroups", "JoinGroups", "None"] },
    ],
  },
  {
    title: "Library access",
    fields: [
      { key: "EnableAllFolders", label: "All libraries", kind: "boolean" },
      { key: "EnabledFolders", label: "Allowed libraries", kind: "folders", hint: "Used when All libraries is off." },
      { key: "BlockedMediaFolders", label: "Blocked libraries", kind: "folders" },
      { key: "EnableAllChannels", label: "All channels", kind: "boolean" },
      { key: "EnabledChannels", label: "Enabled channels", kind: "strings", hint: "Channel ids, comma separated." },
      { key: "BlockedChannels", label: "Blocked channels", kind: "strings" },
      { key: "EnableAllDevices", label: "All devices", kind: "boolean" },
      { key: "EnabledDevices", label: "Enabled devices", kind: "strings", hint: "Device ids, comma separated." },
    ],
  },
  {
    title: "Parental controls",
    fields: [
      { key: "MaxParentalRating", label: "Max parental rating", kind: "number", hint: "Blank for no limit." },
      { key: "MaxParentalSubRating", label: "Max parental sub-rating", kind: "number" },
      {
        key: "BlockUnratedItems",
        label: "Block unrated",
        kind: "strings",
        hint: "Any of Movie, Trailer, Series, Music, Book, LiveTvChannel, LiveTvProgram, ChannelContent, Other, comma separated.",
      },
      { key: "AllowedTags", label: "Allowed tags", kind: "strings" },
      { key: "BlockedTags", label: "Blocked tags", kind: "strings" },
      { key: "AccessSchedules", label: "Access schedules", kind: "json", hint: "JSON list of {DayOfWeek, StartHour, EndHour}." },
    ],
  },
  {
    title: "Management",
    fields: [
      { key: "EnableContentDeletion", label: "Delete media", kind: "boolean" },
      { key: "EnableContentDeletionFromFolders", label: "Delete from these libraries only", kind: "folders" },
      { key: "EnableCollectionManagement", label: "Manage collections", kind: "boolean" },
      { key: "EnableSubtitleManagement", label: "Manage subtitles", kind: "boolean" },
      { key: "EnableLyricManagement", label: "Manage lyrics", kind: "boolean" },
      { key: "EnableLiveTvAccess", label: "Live TV access", kind: "boolean" },
      { key: "EnableLiveTvManagement", label: "Live TV management", kind: "boolean" },
      { key: "EnableRemoteControlOfOtherUsers", label: "Remote control other users", kind: "boolean" },
      { key: "EnableSharedDeviceControl", label: "Control shared devices", kind: "boolean" },
    ],
  },
];

/** Keys the editor never touches; Jellyfin keeps its own values for them. */
export const POLICY_READONLY_KEYS = ["AuthenticationProviderId", "PasswordResetProviderId", "InvalidLoginAttemptCount"];
