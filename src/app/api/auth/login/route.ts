import { NextResponse, type NextRequest } from "next/server";
import { JellyfinError, authenticate } from "@/lib/jellyfin";
import { loginToJellyseerr } from "@/lib/jellyseerr";
import { allowLoginAttempt, clearLoginAttempts, clientKey } from "@/lib/rate-limit";
import {
  SESSION_COOKIE,
  newSessionExpiry,
  sealSession,
  sessionCookieOptions,
  type Session,
} from "@/lib/session";

const MAX_FIELD_LENGTH = 256;

type LoginBody = { username?: unknown; password?: unknown };

function parseBody(body: LoginBody): { username: string; password: string } | null {
  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string") return null;
  const trimmed = username.trim();
  if (!trimmed || trimmed.length > MAX_FIELD_LENGTH || password.length > MAX_FIELD_LENGTH) {
    return null;
  }
  return { username: trimmed, password };
}

export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const credentials = parseBody(body);
  if (!credentials) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const key = clientKey(request);
  if (!allowLoginAttempt(key, credentials.username)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const deviceId = crypto.randomUUID();
  try {
    const auth = await authenticate(credentials.username, credentials.password, deviceId);
    const jellyseerrCookie = await loginToJellyseerr(credentials.username, credentials.password);
    const session: Session = {
      token: auth.AccessToken,
      userId: auth.User.Id,
      userName: auth.User.Name,
      isAdmin: Boolean(auth.User.Policy?.IsAdministrator),
      deviceId,
      jellyseerrCookie: jellyseerrCookie ?? undefined,
      exp: newSessionExpiry(),
    };
    clearLoginAttempts(key, credentials.username);
    const response = NextResponse.json({
      user: { id: session.userId, name: session.userName, isAdmin: session.isAdmin },
      requestsLinked: Boolean(jellyseerrCookie),
    });
    response.cookies.set(SESSION_COOKIE, await sealSession(session), sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof JellyfinError && (error.status === 401 || error.status === 403)) {
      return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
    }
    console.error("[auth/login] Jellyfin login failed:", error);
    return NextResponse.json(
      { error: "Could not reach the media server." },
      { status: 502 },
    );
  }
}
