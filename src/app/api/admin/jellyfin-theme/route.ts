import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { applyJellyfinTheme, getBranding, isThemeApplied, restoreJellyfinTheme } from "@/lib/jellyfin-branding";

export async function GET() {
  const { error } = await requireAdminApi();
  if (error) return error;
  try {
    const branding = await getBranding();
    return NextResponse.json({ applied: isThemeApplied(branding) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin/jellyfin-theme] read failed:", err);
    return NextResponse.json({ error: "Could not read Jellyfin branding." }, { status: 502 });
  }
}

/** Apply or restore the MCrypted custom CSS on the Jellyfin server. */
export async function POST(request: NextRequest) {
  const { session, error } = await requireAdminApi();
  if (error) return error;
  let body: { action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (body.action !== "apply" && body.action !== "restore") {
    return NextResponse.json({ error: "action must be apply or restore." }, { status: 400 });
  }
  try {
    if (body.action === "apply") await applyJellyfinTheme(session);
    else await restoreJellyfinTheme(session);
    const branding = await getBranding();
    return NextResponse.json({ applied: isThemeApplied(branding) });
  } catch (err) {
    console.error(`[admin/jellyfin-theme] ${body.action} failed:`, err);
    return NextResponse.json({ error: "Jellyfin rejected the branding update." }, { status: 502 });
  }
}
