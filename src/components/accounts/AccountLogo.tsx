"use client";

import { useState } from "react";

// Square account avatar: the account's logo, or initials as a fallback.
//
// Three source modes:
//   • logoUrl — an explicit data-URI (account header / profile preview, where
//     the blob is already loaded). Used directly.
//   • slug + hasLogo===true — fetch from the cached /api/accounts/[slug]/logo
//     route (lists, so the blob stays out of the list payload).
//   • slug + hasLogo===undefined — try the route, fall back to initials on
//     error (recents, where we don't know whether a logo exists).
// hasLogo===false (or no source) renders initials directly — no request.

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function AccountLogo({
  name,
  logoUrl,
  slug,
  hasLogo,
  size = 32,
  className = "",
}: {
  name: string;
  /** Explicit data-URI source (already-loaded blob). */
  logoUrl?: string | null;
  /** Account slug — resolves the logo via the image route when no logoUrl. */
  slug?: string;
  /** Known logo presence. true → image; false → initials; undefined → try image, fall back on error. */
  hasLogo?: boolean;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  const src = logoUrl ?? (slug && hasLogo !== false ? `/api/account-logo/${slug}` : null);
  const showImg = !!src && !errored;

  const dim = { width: size, height: size };

  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src!}
        alt={`${name} logo`}
        style={dim}
        onError={() => setErrored(true)}
        className={`shrink-0 rounded-md border border-border object-contain bg-bg-raised ${className}`}
      />
    );
  }

  return (
    <div
      style={{ ...dim, fontSize: Math.round(size * 0.4) }}
      className={`shrink-0 flex items-center justify-center rounded-md border border-border bg-bg-sunken font-medium text-ink-muted ${className}`}
      aria-label={`${name} initials`}
    >
      {initials(name)}
    </div>
  );
}
