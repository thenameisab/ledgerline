/**
 * Account merge/delete approval-flow emails. Pure functions — subject + HTML +
 * plaintext, no sending. Same table-based layout and hex palette as
 * invite-email.ts (email accounts can't resolve oklch or CSS variables).
 */

// Hex approximations of the Ledgerline palette for email clients.
const C = {
  bg: "#f7f7f7",
  card: "#ffffff",
  ink: "#050505",
  muted: "#292f32",
  faint: "#616d75",
  border: "#dee1e3",
  accent: "#1364f1",
};

type Built = { subject: string; html: string; text: string };

function shell(opts: { heading: string; bodyHtml: string; ctaLabel: string; ctaUrl: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.heading}</title>
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
              ${opts.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 0 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background-color:${C.accent};">
                    <a href="${opts.ctaUrl}" target="_blank"
                       style="display:inline-block;padding:12px 22px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:8px;">
                      ${opts.ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 36px 36px;">
              <div style="border-top:1px solid ${C.border};padding-top:16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:${C.faint};">
                Ledgerline · billing & revenue
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildAccountOpRequestEmail(input: {
  kind: "merge" | "delete";
  requesterName: string;
  sourceName: string;
  targetName: string | null;
  approvalsUrl: string;
}): Built {
  const detail =
    input.kind === "merge" ? `${input.sourceName} → ${input.targetName}` : input.sourceName;
  const subject = `Approval needed: ${input.kind} account ${input.sourceName}`;
  const text = [
    `${input.requesterName} requested to ${input.kind} the account ${detail}.`,
    "",
    "Review and approve or decline:",
    input.approvalsUrl,
    "",
    "Ledgerline · billing & revenue",
  ].join("\n");
  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${C.muted};">
      <strong style="color:${C.ink};">${input.requesterName}</strong> requested to
      <strong style="color:${C.ink};">${input.kind}</strong> the account
      <strong style="color:${C.ink};">${detail}</strong>. The change only applies once an admin approves it.
    </p>`;
  return { subject, text, html: shell({ heading: subject, bodyHtml, ctaLabel: "Review request", ctaUrl: input.approvalsUrl }) };
}

export function buildAccountOpDecisionEmail(input: {
  kind: "merge" | "delete";
  approved: boolean;
  sourceName: string;
  targetName: string | null;
  appUrl: string;
}): Built {
  const detail =
    input.kind === "merge" ? `${input.sourceName} → ${input.targetName}` : input.sourceName;
  const verdict = input.approved ? "approved" : "declined";
  const subject = `Request ${verdict}: ${input.kind} account ${input.sourceName}`;
  const text = [
    `Your request to ${input.kind} the account ${detail} was ${verdict}${input.approved ? " and applied" : ""}.`,
    "",
    input.appUrl,
    "",
    "Ledgerline · billing & revenue",
  ].join("\n");
  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${C.muted};">
      Your request to <strong style="color:${C.ink};">${input.kind}</strong> the account
      <strong style="color:${C.ink};">${detail}</strong> was
      <strong style="color:${C.ink};">${verdict}</strong>${input.approved ? " and applied" : ""}.
    </p>`;
  return { subject, text, html: shell({ heading: subject, bodyHtml, ctaLabel: "Open Ledgerline", ctaUrl: input.appUrl }) };
}
