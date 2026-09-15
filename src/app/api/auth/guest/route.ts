import { NextResponse } from "next/server";
import { guestSession } from "@/lib/guest";
import { SESSION_COOKIE, sealSession, sessionCookieOptions } from "@/lib/session";

/** Sign a visitor in as the shared guest account. */
export async function POST() {
  try {
    const session = await guestSession();
    if (!session) {
      return NextResponse.json(
        { error: "Guest access is not set up yet. Ask the admin to enable it." },
        { status: 503 },
      );
    }
    const response = NextResponse.json({ user: { id: session.userId, name: "Guest", isAdmin: false, isGuest: true } });
    response.cookies.set(SESSION_COOKIE, await sealSession(session), sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("[auth/guest] failed:", error);
    return NextResponse.json({ error: "Could not start a guest session." }, { status: 502 });
  }
}
