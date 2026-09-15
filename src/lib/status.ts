import "server-only";
import { getCounts, getSessions, getStorage, getSystemInfo } from "./jellyfin";
import type { Session } from "./session";
import type { FolderStorage, SessionInfo, SystemStorage } from "./types";

export type LibraryUsage = {
  library: string;
  path: string;
  used: number;
  free: number;
};

export type StatusPayload = {
  online: boolean;
  server: { name: string; version: string; os?: string; arch?: string } | null;
  titles: { movies: number; series: number; episodes: number; boxSets: number };
  storage: { used: number; free: number; libraries: LibraryUsage[] } | null;
  streams: SessionInfo[];
  appUptimeMs: number;
  isAdminView: boolean;
};

/** Every folder across every library, tagged with its library name. */
function flattenFolders(storage: SystemStorage): LibraryUsage[] {
  return (storage.Libraries ?? []).flatMap((library) =>
    (library.Folders ?? []).map((folder) => ({
      library: library.Name,
      path: folder.Path,
      used: folder.UsedSpace ?? 0,
      free: folder.FreeSpace ?? 0,
    })),
  );
}

/** Folders on the same device report the same numbers; count each device once. */
function uniqueDevices(storage: SystemStorage): FolderStorage[] {
  const seen = new Set<string>();
  return (storage.Libraries ?? [])
    .flatMap((library) => library.Folders ?? [])
    .filter((folder) => {
      const key = folder.DeviceId || folder.Path;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function buildStatus(session: Session): Promise<StatusPayload> {
  const [counts, info, storage, sessions] = await Promise.all([
    getCounts(session).catch(() => null),
    getSystemInfo(session).catch(() => null),
    getStorage(session).catch(() => null),
    getSessions(session).catch(() => [] as SessionInfo[]),
  ]);

  const devices = storage ? uniqueDevices(storage) : [];
  return {
    online: counts !== null,
    server: info
      ? {
          name: info.ServerName,
          version: info.Version,
          os: info.OperatingSystemDisplayName || info.OperatingSystem,
          arch: info.SystemArchitecture,
        }
      : null,
    titles: {
      movies: counts?.MovieCount ?? 0,
      series: counts?.SeriesCount ?? 0,
      episodes: counts?.EpisodeCount ?? 0,
      boxSets: counts?.BoxSetCount ?? 0,
    },
    storage: storage
      ? {
          used: devices.reduce((sum, f) => sum + (f.UsedSpace ?? 0), 0),
          free: devices.reduce((sum, f) => sum + (f.FreeSpace ?? 0), 0),
          libraries: flattenFolders(storage),
        }
      : null,
    streams: sessions.filter((s) => s.NowPlayingItem),
    appUptimeMs: Math.round(process.uptime() * 1000),
    isAdminView: info !== null,
  };
}
