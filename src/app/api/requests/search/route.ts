import { NextResponse, type NextRequest } from "next/server";
import { hasRequestAccess, isJellyseerrConfigured, searchMedia } from "@/lib/jellyseerr";
import { getSession } from "@/lib/session";

const MAX_QUERY_LENGTH = 120;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isJellyseerrConfigured() || !hasRequestAccess(session)) {
    return NextResponse.json({ error: "Requests are not available." }, { status: 503 });
  }
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) return NextResponse.json({ results: [] });
  try {
    const page = await searchMedia(session, query);
    const results = page.results.filter((r) => r.mediaType === "movie" || r.mediaType === "tv");
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[requests/search] failed:", error);
    return NextResponse.json({ error: "Search failed." }, { status: 502 });
  }
}
