import { NextResponse, type NextRequest } from "next/server";
import { updateProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { THEME_COOKIE, isTheme, themeCookieOptions } from "@/lib/theme";

/** Theme is a cookie for everyone (so the server can render it) and saved to the profile for members. */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { theme?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isTheme(body.theme)) {
    return NextResponse.json({ error: "Theme must be dark, light, or auto." }, { status: 400 });
  }
  if (!session.isGuest) updateProfile(session.userId, { theme: body.theme });
  const response = NextResponse.json({ theme: body.theme });
  response.cookies.set(THEME_COOKIE, body.theme, themeCookieOptions());
  return response;
}
