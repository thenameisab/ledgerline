import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "user-management",
  title: "User management",
  summary:
    "Invite teammates by email, assign admin, editor, or member roles, and manage the invited → active → disabled lifecycle — with guards so you can never lock everyone out.",
  group: "Admin",
  role: "admin",
  routes: ["/admin/users"],
};

export default function Body() {
  return (
    <>
      <p>
        Ledgerline is invite-only. A person can use Ledgerline only after an admin adds their email.
        The Users page manages the full lifecycle on one screen: send an invite, change roles, and
        disable access when someone leaves. In the demo, sign-in uses only the seeded admin and
        member users, so an invited person cannot sign in and the row stays <em>Invited</em>.
      </p>

      <Figure
        src="/help/shots/admin-users.png"
        alt="Users page with the invite form and the team table showing status pills and role dropdowns"
        caption="Invite form on top; the team with status, last login, and role per row."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Invite form</strong> — email, display name, and role (member, editor, or admin;
          member by default). After
          sending, a banner reports the outcome: emailed, failed (with retry), or — if no mail
          account is configured — a note to share the link manually.
        </li>
        <li>
          <strong>Team table</strong> — avatar (emoji or initials), name, email and job title, a
          status pill (<em>Active</em> green · <em>Invited</em> orange with its expiry ·{" "}
          <em>Disabled</em> red), last login, and a role dropdown.
        </li>
      </ul>

      <Callout variant="info" title="Invites expire after 2 days">
        An unaccepted invite lapses after two days; expired rows tint orange. <strong>Resend</strong>{" "}
        re-arms the window and re-sends the email.
      </Callout>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Invite</strong> — adds the person to Users with the status <em>Invited</em> and
          an expiry date. The demo has no mail credentials, so the banner asks you to share the
          sign-in link by hand.
        </li>
        <li>
          <strong>Change roles</strong> — set member, editor, or admin straight from the dropdown.
          <em>Editor</em> is the admin-minus role: it can edit pricing, manage manual entries,
          resolve aliases and API review, set sandbox billing rules, and read margin — pricing an
          account blind to its cost is the mistake the role most needs to avoid. It cannot touch
          users, syncs, or the vendor rate card that produces those costs.
        </li>
        <li>
          <strong>Resend / cancel</strong> pending invites; <strong>disable</strong> active
          accounts; <strong>reactivate</strong> disabled ones.
        </li>
        <li>
          <strong>Edit a profile</strong> — name, job title, and avatar emoji (email is fixed).
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Last-admin guards</strong> — the last active admin can be neither demoted nor
          disabled, and you cannot disable yourself (your own row shows "You" instead of
          actions). There is no state where nobody can administer Ledgerline.
        </li>
        <li>
          <strong>Disabling is a soft delete</strong> — the account, its history, and its audit
          trail remain; only sign-in is revoked. Reactivation restores access as it was.
        </li>
        <li>
          <strong>Everything is audited</strong> — invites, resends, role changes, disables, and
          reactivations all write audit events.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/authentication", label: "Authentication & access control" },
          { href: "/help/features/audit-log", label: "Audit log" },
          { href: "/help/guides", label: "How-to guides" },
        ]}
      />
    </>
  );
}
