import { isTheme, type Theme } from "./theme-shared";

export { THEMES, isTheme, type Theme } from "./theme-shared";

export const THEME_COOKIE = "mc_theme";
const THEME_COOKIE_DAYS = 365;

export function themeCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge: THEME_COOKIE_DAYS * 24 * 60 * 60,
  };
}

/** Theme for rendering: the cookie wins, otherwise the site default (dark). */
export function resolveTheme(cookieValue: string | undefined): Theme {
  return isTheme(cookieValue) ? cookieValue : "dark";
}
