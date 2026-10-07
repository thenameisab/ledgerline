import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "invite-a-user",
  title: "Invite a user",
  summary: "Add a teammate to Ledgerline by email, choose their role, and track the invite until they sign in.",
  group: "Team & access",
  role: "admin",
  minutes: 3,
};

export default function Body() {
  return (
    <>
      <p>
        Access to Ledgerline is invite-only. A person can use Ledgerline only after an admin adds
        their email. Members can read everything. Admins can also edit pricing, costs, users, and
        configuration. In the demo, sign-in uses only the seeded admin and member users, so an
        invited person cannot sign in.
      </p>

      <Figure
        src="/help/shots/admin-users.png"
        alt="The Users admin page with the invite form on top and the users table below"
        caption="Admin → Users: the invite form sits above the user list."
      />

      <H2 id="invite">Send the invite</H2>
      <Steps>
        <Step title="Open Admin → Users">
          The invite form is at the top of the page, under “Invite a user”.
        </Step>
        <Step title="Fill Email, Name, and Role">
          Email must be the address they will sign in with. Role defaults to{" "}
          <strong>Member</strong>; pick <strong>Admin</strong> only for people who should edit
          pricing and configuration.
        </Step>
        <Step title="Click “Send invite”">
          A banner confirms the outcome: “Invite emailed to …” on success, a retry option if the
          email failed, or a note to share the link by hand if no email service is configured. The
          demo has no mail credentials, so it shows the note.
        </Step>
      </Steps>

      <H2 id="track">Track and manage the invite</H2>
      <Steps>
        <Step title="Watch the status pill">
          The new row shows <strong>Invited</strong> with its expiry date. Invites expire after 2
          days; expired rows are flagged.
        </Step>
        <Step title="Resend or cancel">
          <strong>Resend</strong> sends the email again and starts a new 2-day window.{" "}
          <strong>Cancel</strong> withdraws the invitation.
        </Step>
        <Step title="Check the status">
          The demo sign-in accepts only <strong>Active</strong> users and does not activate
          invited users, so the new row stays <strong>Invited</strong> until it expires or you
          cancel it.
        </Step>
      </Steps>

      <Callout variant="info">
        Every invite, resend, cancellation, and role change is recorded in the audit log.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/manage-roles-and-access", label: "Change a role or disable a user" },
          { href: "/help/guides/sign-in-to-ledgerline", label: "Sign in to Ledgerline" },
          { href: "/help/guides/read-the-audit-log", label: "Read the audit log" },
        ]}
      />
    </>
  );
}
