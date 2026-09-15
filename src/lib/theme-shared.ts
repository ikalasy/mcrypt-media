/** Theme names, importable from client components. */

export const THEMES = ["dark", "light", "auto"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
