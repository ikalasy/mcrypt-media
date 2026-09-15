import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/env";
import { pingServer } from "@/lib/jellyfin";

/** Unauthenticated liveness check for Docker healthchecks and the nav indicator. */
export async function GET() {
  try {
    const info = await pingServer();
    return NextResponse.json(
      { ok: true, app: APP_VERSION, jellyfin: info.Version },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, app: APP_VERSION, jellyfin: null },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
