import type { FeatureMeta } from "../types";
import { H2, Kbd, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "navigation",
  title: "Sidebar & navigation",
  summary:
    "The collapsible sidebar: main sections for everyone, an Admin area that only admins see, search, your profile, and a status bar on every page.",
  group: "Platform",
  role: "all",
  routes: [],
};

export default function Body() {
  return (
    <>
      <p>
        The sidebar is the app&rsquo;s map, and it is role-aware: members see exactly the three
        main sections plus help, while admins additionally get the whole Admin area. Nothing you
        can&rsquo;t use is ever shown greyed out — if you can see it, you can open it.
      </p>

      <Figure
        src="/help/shots/dashboard-full.png"
        alt="The app with the sidebar visible"
        caption="The role-aware sidebar — Main for everyone, Review for editors and admins, Settings for admins."
      />

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Main</strong> — Dashboard (<Kbd>⌘1</Kbd>), Accounts (<Kbd>⌘2</Kbd>), APIs (
          <Kbd>⌘3</Kbd>).
        </li>
        <li>
          <strong>Review</strong> (editors and admins) — the work queues, each with the number of
          open items on it: Aliases, API review, Unpriced, Sandbox billing, Approvals. A queue is
          done when its count is zero.
        </li>
        <li>
          <strong>Vendors</strong> (admins only) — the supply side: the vendor list,
          and the reconciliation queue that compares what vendors say they served against what
          Ledgerline counted. Open a vendor for its own rate card and its own reconciliation.
        </li>
        <li>
          <strong>Settings</strong> (admins only) — one entry into a tabbed section: Emails,
          Users, Data &amp; sync, Audit log.
        </li>
        <li>
          <strong>Search button</strong> — opens the same overlay as <Kbd>⌘K</Kbd>.
        </li>
        <li>
          <strong>Help & docs</strong> — this documentation.
        </li>
        <li>
          <strong>Your profile</strong> — avatar, name, email, job title, and a role chip at the
          bottom; click it to edit your name, job title, or avatar emoji, or to sign out.
        </li>
        <li>
          <strong>Status bar</strong> — every page opens with a title, context subtitle (active
          date window, sandbox state), and the page&rsquo;s primary actions on the right.
        </li>
      </ul>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Collapse the sidebar</strong> — the toggle shrinks it to an icon-only rail for
          more table width. The choice persists in a cookie, so it survives reloads.
        </li>
        <li>
          <strong>Navigate by keyboard</strong> — see{" "}
          <a href="/help/features/command-palette">Command palette & keyboard shortcuts</a>.
        </li>
        <li>
          <strong>Edit your profile</strong> — display name, job title, and emoji; you cannot change
          your email.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Member opening an admin URL directly</strong> — hiding the links is cosmetic;
          the pages themselves enforce the role server-side and redirect non-admins.
        </li>
        <li>
          <strong>Small screens</strong> — the sidebar adapts on narrow viewports; the collapse
          toggle is a desktop affordance.
        </li>
        <li>
          <strong>Unknown URL</strong> — a branded 404 offers routes back to the dashboard and the
          accounts directory.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/command-palette", label: "Command palette & shortcuts" },
          { href: "/help/features/authentication", label: "Authentication & access control" },
        ]}
      />
    </>
  );
}
