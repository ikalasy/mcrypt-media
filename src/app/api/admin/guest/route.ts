import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { guestInfo, provisionGuest } from "@/lib/guest";
import { activeGuestStreams } from "@/lib/guest-streams";

export async function GET() {
  const { error } = await requireAdminApi();
  if (error) return error;
  const info = await guestInfo();
  return NextResponse.json({ guest: info, activeStreams: activeGuestStreams() }, { headers: { "Cache-Control": "no-store" } });
}

/** Create or reset the shared guest account. Rotates its password every time. */
export async function POST() {
  const { session, error } = await requireAdminApi();
  if (error) return error;
  try {
    const result = await provisionGuest(session);
    return NextResponse.json({ guest: result });
  } catch (err) {
    console.error("[admin/guest] provisioning failed:", err);
    return NextResponse.json({ error: "Could not provision the guest account in Jellyfin." }, { status: 502 });
  }
}
