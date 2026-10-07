/**
 * Theme preference — light, dark, or follow the OS.
 *
 * Persisted in a plain cookie so the server can stamp `data-theme` on <html>
 * before the first paint. When the preference is "system" there is nothing to
 * stamp, so a tiny inline script resolves it from `prefers-color-scheme` — see
 * `ThemeScript` in the root layout. Every token has a dark pair, so setting the
 * attribute is the whole switch.
 */

export const THEME_COOKIE = "ledgerline_theme";

export type ThemePref = "light" | "dark" | "system";

export function isThemePref(v: unknown): v is ThemePref {
  return v === "light" || v === "dark" || v === "system";
}

/** The attribute value to render server-side; undefined means "let the script decide". */
export function resolvedAttr(pref: ThemePref): "light" | "dark" | undefined {
  return pref === "system" ? undefined : pref;
}
