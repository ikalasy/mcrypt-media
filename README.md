# Movie Crypted

A private media front end in the CryptedSpace style. It sits in front of the
Jellyfin server on TrueNAS, so friends sign in with their Jellyfin accounts and
get the library, continue watching, collections, requests, and server status
without Jellyfin itself ever being exposed to the internet.

## How it fits together

```
browser ──HTTPS──> Nginx Proxy Manager ──> movie-crypted:3000 ──LAN──> jellyfin:8096
                                                               └──LAN──> jellyseerr:5055
```

- **Auth**: `/api/auth/login` calls Jellyfin `Users/AuthenticateByName`. The
  Jellyfin token goes into an AES-GCM encrypted, httpOnly cookie. The browser
  never sees it. Login attempts are rate limited per IP.
- **Proxy**: `/api/jf/*` forwards to Jellyfin with that token attached. Images,
  direct-play video, and HLS transcode segments all flow through it. Writes are
  allow-listed (playback reporting, favorites, watched state); admin endpoints are
  denied even for admins.
- **Requests**: the Search tab shows library hits and, for members, TMDB
  matches from Jellyseerr with a Request button. At login the same credentials
  are tried against Jellyseerr so requests are attributed to the user.
  `JELLYSEERR_API_KEY` is the fallback for users with no Jellyseerr account and
  is required for the admin Server page to list everyone's requests.
- **Playback**: the player sends a browser capability profile to `PlaybackInfo`.
  Jellyfin answers with direct play when the file is browser friendly, otherwise
  an HLS transcode that hls.js plays. Progress is reported every 10 seconds so
  Continue Watching stays in sync with every other Jellyfin client.

## Home, screensaver, and the binary transition

- The featured hero rotates through the eight newest titles every 95 seconds.
  Text scrambles to 0/1 and resolves into the next title; the artwork swaps
  behind a sweeping binary curtain (`src/components/cipher.tsx`).
- After 5 minutes idle (never during playback) a full-screen screensaver shows
  rotating backdrops with the same transition, the clock and date, the
  wordmark, and the current title. Any input dismisses it. In development,
  `?screensaver=1` triggers it after 3 seconds.

## Jellyfin custom theme

`../jellyfin-theme/mcrypted.css` restyles the stock Jellyfin web client to the
same look (paste into Dashboard, General, Custom CSS). It changes appearance
only; every feature above needs Movie Crypted.

## Security testing

Planned and completed penetration tests against this deployment are logged in
[docs/PENTEST.md](docs/PENTEST.md).

## Accounts and roles

- **Admin** (Jellyfin administrator): everything, plus the Users page (full
  Jellyfin policy editor, create, delete, reset passwords) and the Server page
  (library, storage, active streams, 30-day stream history by user, every
  user's requests, guest access control).
- **Member**: library, collections, search with requests, Profile (picture,
  display name, bio), Display (dark, light, auto), Notifications (new titles
  and new episodes of series they watch).
- **Guest**: a shared, auto-provisioned Jellyfin user named `guest`. Browse and
  transcoded playback only, capped at 720p / 4 Mbps, one guest stream at a
  time, no writes of any kind. Enable it from Server, Guest access. The login
  page then shows "Continue as guest".

Display name, bio, theme, notification read state, and the guest credentials
live in a SQLite file under `DATA_DIR` (`./data` in dev, a volume in Docker).
Jellyfin has no fields for them.

## Local development

```bash
cp .env.example .env.local   # already done for this machine
npm install
npm run dev -- --port 3210
```

Open <http://localhost:3210>. The dev server talks to the real Jellyfin and
Jellyseerr at your NAS.

Checks:

```bash
npx tsc --noEmit
npm run lint
```

## Deploying on Dockge (TrueNAS)

1. Create a new stack called `movie-crypted` in Dockge.
2. Copy this folder (minus `node_modules` and `.next`) into the stack directory,
   or clone it from git there.
3. Create `.env` in the stack directory from `.env.example`:
   - `JELLYFIN_URL` and `JELLYSEERR_URL` can stay on the LAN addresses.
   - `SESSION_SECRET`: a fresh 64-character hex string.
   - `COOKIE_SECURE=true` once it is behind HTTPS.
   - `JELLYFIN_API_KEY` (Jellyfin Dashboard, API Keys) if non-admin users
     should see storage and server stats.
4. Paste `compose.yaml` into Dockge and deploy. The first deploy builds the
   image, which takes a few minutes.
5. In Nginx Proxy Manager add a proxy host for your domain pointing at
   `movie-crypted:3000` (or the TrueNAS IP on port 3210), with an SSL cert,
   HTTP/2, and **Websockets Support** on. Block common exploits on.

The container runs as a non-root user and exposes `/api/health` for the
healthcheck.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `JELLYFIN_URL` | yes | Jellyfin base URL reachable from the container |
| `SESSION_SECRET` | yes | Encrypts the session cookie |
| `JELLYSEERR_URL` | no | Enables the Requests tab |
| `JELLYSEERR_API_KEY` | no | Fallback identity for requests |
| `JELLYFIN_API_KEY` | no | Server stats for non-admin users |
| `COOKIE_SECURE` | no | `true` behind HTTPS (default in production), `false` for plain HTTP |
| `CONTACT_EMAIL` | no | Login-page contact link; empty hides it |
| `DATA_DIR` | no | Folder for the SQLite store. Docker sets `/app/data` and mounts a volume |

## Notes for internet exposure

- Only Movie Crypted is published. Jellyfin and Jellyseerr stay on the LAN.
- Keep Jellyfin's own "remote access" off unless you need it for other clients.
- Rate limiting is in-process. If you scale to multiple containers, put the
  limit in Nginx Proxy Manager instead.
- Consider Cloudflare Access or NPM's access lists in front of the login page
  for another layer.
