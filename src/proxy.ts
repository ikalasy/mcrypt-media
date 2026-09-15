import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "mc_session";

/**
 * Cheap gate for page routes: no session cookie means straight to /login.
 * Pages still validate the cookie's contents through requireSession().
 */
export function proxy(request: NextRequest) {
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return hasCookie ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!hasCookie) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|svg|ico|webp)$).*)"],
};
