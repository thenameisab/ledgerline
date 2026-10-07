import "server-only";
import nodemailer from "nodemailer";
import { config } from "./config";

/**
 * Transactional email, sent over SMTP with nodemailer.
 *
 * Identity is split in two, because the From address can be a group address
 * (e.g. billing@ledgerline.local) which has no mailbox and cannot authenticate:
 *   - GMAIL_SENDER     → the From address recipients see. May be a group
 *                        address that the auth account may send as.
 *   - GMAIL_SMTP_USER  → the real mailbox that authenticates. Optional —
 *                        defaults to GMAIL_SENDER.
 *
 * Two auth paths for that mailbox:
 *   - GMAIL_APP_PASSWORD  → SMTP with an app password.
 *   - GMAIL_OAUTH_REFRESH_TOKEN → OAuth2 with the app's OAuth client
 *                           (GOOGLE_CLIENT_ID / _SECRET).
 *
 * If neither is configured, sending is a no-op that reports `skipped`. This is
 * deliberate: an invite must still succeed (the DB row is the source of truth)
 * even when email isn't wired up — the admin just falls back to telling the
 * user manually.
 */

export type SendResult = { ok: boolean; skipped?: boolean; error?: string };

function buildTransport(authUser: string): nodemailer.Transporter | null {
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (appPassword) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: authUser, pass: appPassword },
    });
  }

  const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN;
  if (refreshToken && config.auth.googleClientId && config.auth.googleClientSecret) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: authUser,
        clientId: config.auth.googleClientId,
        clientSecret: config.auth.googleClientSecret,
        refreshToken,
      },
    });
  }

  return null;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const sender = process.env.GMAIL_SENDER;
  if (!sender) {
    console.warn("[email] GMAIL_SENDER not set — skipping send to", input.to);
    return { ok: false, skipped: true };
  }
  // The mailbox that logs in; falls back to the From address when they're one
  // and the same (a group From always needs a separate real auth mailbox).
  const authUser = process.env.GMAIL_SMTP_USER || sender;

  const transport = buildTransport(authUser);
  if (!transport) {
    console.warn(
      "[email] no email credential (GMAIL_APP_PASSWORD or GMAIL_OAUTH_REFRESH_TOKEN) — skipping send to",
      input.to
    );
    return { ok: false, skipped: true };
  }

  try {
    await transport.sendMail({
      from: `Ledgerline <${sender}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[email] send failed:", error);
    return { ok: false, error };
  }
}
