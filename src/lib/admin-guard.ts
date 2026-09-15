import "server-only";
import { NextResponse } from "next/server";
import { getSession, type Session } from "./session";

/** Route-handler guard: admin session or an error response. */
export async function requireAdminApi(): Promise<
  { session: Session; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (!session.isAdmin || session.isGuest) {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }
  return { session };
}

/** Route-handler guard: any real (non-guest) member. */
export async function requireMemberApi(): Promise<
  { session: Session; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (session.isGuest) return { error: NextResponse.json({ error: "Members only." }, { status: 403 }) };
  return { session };
}
