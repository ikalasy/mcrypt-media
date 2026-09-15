import { NextResponse, type NextRequest } from "next/server";
import { BIO_MAX, DISPLAY_NAME_MAX, getProfile, updateProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";

function cleanText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.isGuest) return NextResponse.json({ error: "Guests have no profile." }, { status: 403 });
  return NextResponse.json({ profile: getProfile(session.userId), userName: session.userName });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.isGuest) return NextResponse.json({ error: "Guests cannot edit a profile." }, { status: 403 });

  let body: { displayName?: unknown; bio?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const profile = updateProfile(session.userId, {
    displayName: cleanText(body.displayName, DISPLAY_NAME_MAX),
    bio: cleanText(body.bio, BIO_MAX),
  });
  return NextResponse.json({ profile });
}
