import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "sign-in-to-ledgerline",
  title: "Sign in to Ledgerline",
  summary: "Sign in to the demo as an admin or a member, and what to do when sign-in is refused.",
  group: "Getting started",
  role: "all",
  minutes: 2,
};

export default function Body() {
  return (
    <>
      <p>
        The demo has no passwords. The login page has two buttons. Each one signs you in as a
        seeded user with a fixed role.
      </p>

      <Figure
        src="/help/shots/login.png"
        alt="The Ledgerline login page with the Enter as Admin and Enter as Member buttons"
        caption="The login page. The panel on the left appears on desktop only."
      />

      <H2 id="steps">Sign in</H2>
      <Steps>
        <Step title="Open Ledgerline">
          When you are signed out, every page redirects you to <code>/login</code>. Ledgerline
          remembers the page you asked for and opens it after sign-in.
        </Step>
        <Step title="Choose a role">
          Click <strong>Enter as Admin</strong> to sign in as Maya Sharma, who has full access. Click{" "}
          <strong>Enter as Member</strong> to sign in as Rohan Mehta, who has the read-only view.
        </Step>
        <Step title="Land on the dashboard">
          Ledgerline opens the dashboard, or the page you first asked for.
        </Step>
      </Steps>

      <H2 id="errors">If sign-in is refused</H2>
      <p>
        Sign-in is refused when the seeded user is missing from Users or is not <em>Active</em>.
        This can happen if someone disabled the demo admin or member during a visit. The demo
        database is reset every night, which restores both users.
      </p>
      <Callout variant="info">
        To switch roles, sign out from the account menu and click the other button.
      </Callout>

      <Related
        links={[
          { href: "/help/features/authentication", label: "Authentication & access control" },
          { href: "/help/guides/read-the-dashboard", label: "Read the dashboard" },
          { href: "/help/features", label: "Feature docs" },
        ]}
      />
    </>
  );
}
