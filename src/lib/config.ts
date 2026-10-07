// Single place for env-derived configuration. Read at module load.
// Anything that varies between local / staging / prod flows through here.

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    // We deliberately don't throw at module load — local dev should boot
    // without optional credentials set, and the auth flow surfaces the issue
    // when an unauthenticated user tries to sign in. This avoids "next dev"
    // failing before a developer has had a chance to copy the .env template.
    return "";
  }
  return v;
}

// Auth bypass is a local-dev escape hatch only. If anyone ever sets
// AUTH_BYPASS=true with NODE_ENV=production, fail loudly at module load —
// the alternative is a silently-publicly-accessible admin surface.
const authBypassEnabled = process.env.AUTH_BYPASS === "true";
if (authBypassEnabled && process.env.NODE_ENV === "production") {
  throw new Error(
    "AUTH_BYPASS=true is not permitted with NODE_ENV=production. " +
      "Remove the bypass flag or run a non-production build."
  );
}

export const config = {
  auth: {
    googleClientId: required("GOOGLE_CLIENT_ID"),
    googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
    sessionSecret: required("AUTH_SECRET", "dev-only-not-for-production"),
    // When true (dev only), the app skips real auth and treats every request
    // as the seeded admin user. Refused in production at module load above.
    bypassAuth: authBypassEnabled,
    demoAdminEmail: process.env.AUTH_DEMO_ADMIN_EMAIL ?? "admin@ledgerline.local",
    allowedEmailDomain: process.env.AUTH_ALLOWED_EMAIL_DOMAIN ?? "ledgerline.local",
  },
  briefing: {
    llmEnabled: process.env.BRIEFING_LLM_ENABLED === "true",
    model: process.env.BRIEFING_MODEL ?? "claude-haiku-4-5",
  },
  accountOps: {
    // How long an account merge/delete stays reversible before the cron purge
    // hard-deletes the source and makes the operation permanent.
    undoDays: Number(process.env.ACCOUNT_OP_UNDO_DAYS ?? "30"),
  },
};
