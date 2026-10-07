/**
 * API reference sub-navigation. Each entry is a page under /help/api.
 * Owned by the API reference docs; the help layout renders these in the
 * docs sidebar when the API section is active.
 */
export const apiNav: { href: string; label: string }[] = [
  { href: "/help/api/endpoints", label: "Endpoints" },
  { href: "/help/api/actions", label: "Server actions" },
  { href: "/help/api/integrations", label: "Integrations" },
  { href: "/help/api/database", label: "Database schema" },
  { href: "/help/api/environment", label: "Environment" },
];
