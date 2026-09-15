import { NextResponse, type NextRequest } from "next/server";
import {
  JellyseerrError,
  createRequest,
  hasRequestAccess,
  isJellyseerrConfigured,
  listRequests,
} from "@/lib/jellyseerr";
import { getSession } from "@/lib/session";

function unavailable(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isJellyseerrConfigured()) {
    return NextResponse.json({ error: "Requests are not configured." }, { status: 503 });
  }
  if (!hasRequestAccess(session)) {
    return NextResponse.json(
      { error: "Your account is not linked to the request system yet." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET() {
  const session = await getSession();
  const blocked = unavailable(session);
  if (blocked) return blocked;
  try {
    const requests = await listRequests(session);
    return NextResponse.json({ requests }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[requests] list failed:", error);
    return NextResponse.json({ error: "Could not load requests." }, { status: 502 });
  }
}

type CreateBody = { mediaType?: unknown; tmdbId?: unknown };

export async function POST(request: NextRequest) {
  const session = await getSession();
  const blocked = unavailable(session);
  if (blocked) return blocked;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { mediaType, tmdbId } = body;
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(tmdbId)) {
    return NextResponse.json({ error: "mediaType and tmdbId are required." }, { status: 400 });
  }
  try {
    const created = await createRequest(session, mediaType, tmdbId as number);
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    if (error instanceof JellyseerrError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[requests] create failed:", error);
    return NextResponse.json({ error: "Could not submit the request." }, { status: 502 });
  }
}
