import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "authentication",
  title: "Authentication & access control",
  summary:
    "Demo sign-in with one-click Admin and Member buttons, active-user checks against the Users table, and a three-role model: members read everything, editors edit pricing and billing data, admins change everything.",
  group: "Platform",
  role: "all",
  routes: ["/login"],
};

export default function Body() {
  return (
    <>
      <p>
        There are no passwords in Ledgerline. The demo signs you in with one of two buttons on the
        login page: <strong>Enter as Admin</strong> or <strong>Enter as Member</strong>. Each button
        signs in a seeded user. Sign-in works only if that user exists in Users and has the status{" "}
        <em>Active</em>. After sign-in, your role decides what you can change.
      </p>

      <Figure
        src="/help/shots/login.png"
        alt="Ledgerline login page with the Enter as Admin and Enter as Member buttons"
        caption="The login page. Each button signs in one seeded user."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>The login page</strong> — two buttons. <em>Enter as Admin</em> signs in Maya
          Sharma, who has full access. <em>Enter as Member</em> signs in Rohan Mehta, who has the
          read-only view.
        </li>
        <li>
          <strong>Failure messages</strong> — if sign-in is refused, the login page shows an
          access-denied message.
        </li>
      </ul>

      <H2 id="how-access-works">How access works</H2>
      <ul>
        <li>
          <strong>Users table</strong> — the sign-in provider looks up the email in Users. It
          accepts the sign-in only when the row exists and its status is <em>Active</em>. Invited
          and disabled users cannot sign in.
        </li>
        <li>
          <strong>Session</strong> — the session stores your user id and role. Ledgerline reads both
          from the Users row each time it checks the session, so a role change applies at once.
        </li>
        <li>
          <strong>Roles</strong> — <em>members</em> read everything: dashboard, accounts, SKUs,
          invoices, and exports. <em>Editors</em> also edit account pricing, create and approve
          manual entries, resolve aliases and SKU review, and set sandbox billing rules.{" "}
          <em>Admins</em> can do all of that, and also set vendor costs, finalize and issue
          invoices, manage users, run syncs, and read the audit log. Admins and editors can see
          margin and vendor cost, because an editor sets the account price and needs to see the
          cost. The vendor rate card itself is admin-only. Members see revenue, but never cost or
          margin.
        </li>
      </ul>

      <Callout variant="info" title="Checks run on the server">
        Hidden buttons only make the interface simpler. The server checks the role for every page,
        action, and API route. A crafted URL or request does not bypass a role check, and
        privileged actions are written to the audit log.
      </Callout>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Disabled user</strong> — a disabled user cannot sign in. An admin can enable the
          user again from the Users page.
        </li>
        <li>
          <strong>Already signed in</strong> — the login page redirects you to the dashboard, or to
          the page you first asked for.
        </li>
        <li>
          <strong>Local development</strong> — set <code>AUTH_BYPASS=true</code> to skip the login
          page and open the app as the seeded admin. The app refuses to start with this flag when{" "}
          <code>NODE_ENV</code> is <code>production</code>.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/user-management", label: "User management" },
          { href: "/help/features/audit-log", label: "Audit log" },
          { href: "/help/api/environment", label: "Auth environment variables" },
        ]}
      />
    </>
  );
}
