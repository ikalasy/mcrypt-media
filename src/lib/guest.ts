import "server-only";
import {
  GUEST_DEVICE_ID,
  GUEST_USERNAME,
  getGuestToken,
  readGuestCredentials,
  writeGuestCredentials,
} from "./guest-token";
import { newSessionExpiry, type Session } from "./session";
import { createUser, listUsers, setUserPassword, setUserPolicy, type UserPolicy } from "./users";

/**
 * The public guest account: one shared, locked-down Jellyfin user that the app
 * signs into on a visitor's behalf. Provisioned by an admin from the Server
 * panel; the generated password is stored encrypted in SQLite.
 */

export { GUEST_USERNAME };

/** Ceiling the proxy enforces on guest transcodes (roughly 720p). */
export const GUEST_MAX_BITRATE = 4_000_000;
export const GUEST_MAX_WIDTH = 1280;
export const GUEST_MAX_HEIGHT = 720;

/** Everything off except browsing and transcoded playback. */
export const GUEST_POLICY: UserPolicy = {
  IsAdministrator: false,
  IsHidden: true,
  IsDisabled: false,
  EnableUserPreferenceAccess: false,
  EnableRemoteAccess: true,
  EnablePublicSharing: false,
  EnableMediaPlayback: true,
  EnableVideoPlaybackTranscoding: true,
  EnableAudioPlaybackTranscoding: true,
  EnablePlaybackRemuxing: false,
  ForceRemoteSourceTranscoding: true,
  EnableContentDownloading: false,
  EnableSyncTranscoding: false,
  EnableMediaConversion: false,
  EnableContentDeletion: false,
  EnableContentDeletionFromFolders: [],
  EnableCollectionManagement: false,
  EnableSubtitleManagement: false,
  EnableLyricManagement: false,
  EnableLiveTvAccess: false,
  EnableLiveTvManagement: false,
  EnableRemoteControlOfOtherUsers: false,
  EnableSharedDeviceControl: false,
  EnableAllFolders: true,
  EnabledFolders: [],
  EnableAllChannels: false,
  EnabledChannels: [],
  EnableAllDevices: true,
  EnabledDevices: [],
  // One shared session for every visitor; concurrent streams are limited by the proxy.
  MaxActiveSessions: 1,
  RemoteClientBitrateLimit: GUEST_MAX_BITRATE,
  LoginAttemptsBeforeLockout: -1,
  SyncPlayAccess: "None",
  BlockedTags: [],
  AllowedTags: [],
  BlockUnratedItems: [],
  AccessSchedules: [],
  BlockedMediaFolders: [],
  BlockedChannels: [],
};

export async function guestInfo(): Promise<{ userId: string; provisionedAt: string } | null> {
  const creds = await readGuestCredentials();
  return creds ? { userId: creds.userId, provisionedAt: creds.provisionedAt } : null;
}

/**
 * Create (or adopt) the Jellyfin guest user, apply the locked-down policy, and
 * store a fresh random password. Running it again re-applies the policy and
 * rotates the password.
 */
export async function provisionGuest(admin: Session): Promise<{ userId: string }> {
  const existing = (await listUsers(admin)).find((u) => u.Name.toLowerCase() === GUEST_USERNAME);
  const password = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
  const user = existing ?? (await createUser(admin, GUEST_USERNAME, password));
  // Library scoping is the admin's call (Users > guest > Library access); keep it across resets.
  const keep = existing?.Policy ?? {};
  await setUserPolicy(admin, user.Id, {
    ...GUEST_POLICY,
    EnableAllFolders: keep.EnableAllFolders ?? GUEST_POLICY.EnableAllFolders,
    EnabledFolders: keep.EnabledFolders ?? GUEST_POLICY.EnabledFolders,
    BlockedMediaFolders: keep.BlockedMediaFolders ?? GUEST_POLICY.BlockedMediaFolders,
  });
  if (existing) await setUserPassword(admin, user.Id, password);
  await writeGuestCredentials({ userId: user.Id, password, provisionedAt: new Date().toISOString() });
  return { userId: user.Id };
}

/** Cookie session for a visitor. The token inside is the shared one and is refreshed on read. */
export async function guestSession(): Promise<Session | null> {
  const creds = await readGuestCredentials();
  if (!creds) return null;
  const token = await getGuestToken();
  if (!token) return null;
  return {
    token,
    userId: creds.userId,
    userName: "Guest",
    isAdmin: false,
    isGuest: true,
    visitorId: crypto.randomUUID(),
    deviceId: GUEST_DEVICE_ID,
    exp: newSessionExpiry(),
  };
}
