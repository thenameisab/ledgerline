/**
 * Invite email content. Pure function — returns subject + HTML + plaintext,
 * no sending. Table-based layout with inline styles for broad email-account
 * support; colours are hex approximations of the design tokens (email accounts
 * can't resolve oklch or CSS variables).
 */

type InviteEmailInput = {
  displayName: string;
  role: "admin" | "editor" | "member";
  loginUrl: string;
  expiresInDays: number;
  inviterName?: string | null;
};

// Hex approximations of the Ledgerline palette for email clients.
const C = {
  bg: "#f7f7f7", // cream page
  card: "#ffffff", // raised surface
  ink: "#050505",
  muted: "#292f32",
  faint: "#616d75",
  border: "#dee1e3",
  accent: "#1364f1", // deep teal
};

export function buildInviteEmail(input: InviteEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { displayName, role, loginUrl, expiresInDays, inviterName } = input;
  const roleLabel = role === "admin" ? "an admin" : role === "editor" ? "an editor" : "a member";
  const invitedBy = inviterName ? `${inviterName} invited you` : "You've been invited";
  const expiry = `${expiresInDays} day${expiresInDays === 1 ? "" : "s"}`;

  const subject = "You're invited to Ledgerline";

  const text = [
    `Hi ${displayName},`,
    "",
    `${invitedBy} to Ledgerline as ${roleLabel}. Ledgerline is the billing and invoicing dashboard.`,
    "",
    `Sign in with your Google account (the address this email was sent to):`,
    loginUrl,
    "",
    `This invite expires in ${expiry}. If it lapses, ask an admin to resend it.`,
    "",
    "Ledgerline",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.bg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:${C.card};border:1px solid ${C.border};border-radius:16px;">
          <tr>
            <td style="padding:36px 36px 0 36px;">
              <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:600;color:${C.ink};letter-spacing:-0.01em;">
                Ledgerline<span style="color:${C.accent};">.</span>
              </div>
              <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:${C.faint};margin-top:4px;">
                Billing &amp; invoicing
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 0 36px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:${C.ink};">Hi ${displayName},</p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${C.muted};">
                ${invitedBy} to <strong style="color:${C.ink};">Ledgerline</strong> as ${roleLabel}, the billing and invoicing dashboard. Sign in with the address this email was sent to.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 0 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background-color:${C.accent};">
                    <a href="${loginUrl}" target="_blank"
                       style="display:inline-block;padding:12px 22px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Sign in to Ledgerline
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 36px 0 36px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:${C.faint};">
                This invite expires in ${expiry}. If it lapses, ask an admin to resend it.
              </p>
              <p style="margin:14px 0 0 0;font-size:12px;line-height:1.6;color:${C.faint};word-break:break-all;">
                Button not working? Paste this into your browser:<br />
                <a href="${loginUrl}" target="_blank" style="color:${C.accent};">${loginUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 36px 36px;">
              <div style="border-top:1px solid ${C.border};padding-top:16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${C.faint};">
                Ledgerline
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
