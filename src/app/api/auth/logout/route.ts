import { NextResponse } from "next/server";
import { jf } from "@/lib/jellyfin";
import { SESSION_COOKIE, getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (session) {
    try {
      await jf("Sessions/Logout", {
        method: "POST",
        token: session.token,
        deviceId: session.deviceId,
      });
    } catch (error) {
      console.warn("[auth/logout] Jellyfin logout failed, clearing cookie anyway:", error);
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
