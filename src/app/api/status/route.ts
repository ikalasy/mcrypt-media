import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildStatus } from "@/lib/status";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const payload = await buildStatus(session);
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
