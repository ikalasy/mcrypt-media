import { NextResponse } from "next/server";
import { hasRequestAccess } from "@/lib/jellyseerr";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: session.userId, name: session.userName, isAdmin: session.isAdmin },
    requestsLinked: hasRequestAccess(session),
  });
}
