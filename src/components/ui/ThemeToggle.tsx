"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { THEME_COOKIE, isThemePref, type ThemePref } from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  // "Auto" rather than "System" — three segments plus icons have to fit inside
  // the account menu, which is only as wide as the sidebar rail.
  { value: "system", label: "Auto", icon: Monitor },
];

/**
 * Theme preference control — a three-way segmented switch in the user menu.
 *
 * Writes the cookie (so the next server render stamps the right attribute) and
 * flips `data-theme` on <html> immediately, so the change lands in the same
 * frame as the click rather than waiting for a round trip.
 */
export function ThemeToggle() {
  // Read from the DOM rather than the cookie so the control agrees with what's
  // actually on screen, including the case where the inline script resolved
  // "system" to dark.
  const [pref, setPref] = useState<ThemePref>("system");

  useEffect(() => {
    const stored = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${THEME_COOKIE}=`))
      ?.slice(THEME_COOKIE.length + 1);
    if (isThemePref(stored)) setPref(stored);
  }, []);

  function apply(next: ThemePref) {
    setPref(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const resolved =
      next === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : next;
    document.documentElement.dataset.theme = resolved;
  }

  return (
    <div className="px-3 py-2">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-ink-faint">
        Theme
      </div>
      <div
        className="inline-flex w-full rounded border border-border bg-bg-sunken p-[3px] gap-[3px]"
        role="group"
        aria-label="Theme"
      >
        {OPTIONS.map((o) => {
          const active = o.value === pref;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => apply(o.value)}
              title={o.value === "system" ? "Follow the system theme" : o.label}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-sm px-1.5 py-1.5 text-[10px] font-medium transition-[background-color,color,box-shadow] duration-fast ease-standard ${
                active
                  ? "bg-accent text-bg-raised shadow-bevel"
                  : "text-ink-faint hover:bg-bg-raised hover:text-ink-muted"
              }`}
            >
              <Icon size={12} strokeWidth={1.75} aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
