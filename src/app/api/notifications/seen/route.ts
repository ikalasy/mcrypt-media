import { NextResponse } from "next/server";
import { markNotificationsSeen } from "@/lib/profile";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.isGuest) return NextResponse.json({ error: "Guests have no notifications." }, { status: 403 });
  markNotificationsSeen(session.userId);
  return NextResponse.json({ ok: true });
}
