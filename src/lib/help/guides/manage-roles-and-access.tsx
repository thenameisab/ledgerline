import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "manage-roles-and-access",
  title: "Change a role or disable a user",
  summary: "Promote, demote, disable, and reactivate teammates — and the guard rails that stop you locking everyone out.",
  group: "Team & access",
  role: "admin",
  minutes: 3,
};

export default function Body() {
  return (
    <>
      <p>
        Roles and access are managed inline on the Users page. There are three roles:{" "}
        <strong>member</strong> (read everything), <strong>editor</strong> (also edit account
        pricing, manual entries, aliases, SKU review, sandbox billing rules, the SKU catalog,
        account profiles, and groups), and{" "}
        <strong>admin</strong> (all of that plus vendor costs, users, syncs, and the audit log —
        and the only role that sees cost/margin figures).
      </p>

      <Figure
        src="/help/shots/admin-users.png"
        alt="The Users table with role dropdowns and per-row actions"
        caption="Each row: status pill, last login, role dropdown, and actions."
      />

      <H2 id="role">Change a role</H2>
      <Steps>
        <Step title="Open Admin → Users">
          Find the user; the subtitle counts totals, actives, invited, and admins.
        </Step>
        <Step title="Pick the new role in the row’s dropdown">
          Member, Editor, or Admin — the change takes effect immediately and is written to the
          audit log.
        </Step>
      </Steps>

      <H2 id="disable">Disable or reactivate</H2>
      <Steps>
        <Step title="Click “Disable” on an active user">
          Their session stops working and sign-in is refused. The row turns red with a{" "}
          <strong>Disabled</strong> pill; their history (entries, audit events) is untouched.
        </Step>
        <Step title="Click “Reactivate” to restore access">
          The user can sign in again with the same email. A new invite is not necessary.
        </Step>
      </Steps>

      <Callout variant="warn" title="Guard rails">
        You cannot disable your own account, and you cannot demote or disable the last active
        admin — the controls are blocked so the workspace can never end up admin-less.
      </Callout>

      <H2 id="edit">Edit someone’s profile</H2>
      <p>
        The pencil icon on each row opens the same profile modal users see themselves — name, job
        title, and avatar emoji — handy for tidying up display names. Email is read-only.
      </p>

      <Related
        links={[
          { href: "/help/guides/invite-a-user", label: "Invite a user" },
          { href: "/help/guides/edit-your-profile", label: "Edit your profile" },
          { href: "/help/guides/read-the-audit-log", label: "Read the audit log" },
        ]}
      />
    </>
  );
}
