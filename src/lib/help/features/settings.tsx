import type { FeatureMeta } from "../types";
import { H2, Callout, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "settings",
  title: "Settings",
  summary:
    "The admin-only section: scheduled email digests, users, data & sync, and the audit log, as tabs across one surface.",
  group: "Admin",
  role: "admin",
  routes: ["/admin/settings"],
};

export default function Body() {
  return (
    <>
      <p>
        Settings is one sidebar entry that opens a tabbed section. Every tab keeps its own URL, so
        links and command-palette entries still land directly on a tab; the strip along the top is
        how you move between them.
      </p>

      <H2 id="what-you-see">What you see</H2>
      <ul>
        <li>
          <strong>Emails</strong> — recipient lists for the revenue roundups (daily, weekly,
          monthly) and the weekly product updates. An empty list turns that email off. Only
          @ledgerline.local addresses.
        </li>
        <li>
          <strong>Users</strong> — invite, change role, disable. See{" "}
          <a href="/help/features/user-management">User management</a>.
        </li>
        <li>
          <strong>Data &amp; sync</strong> — run history, gap warnings, the on-demand refresh, and
          date-range backfills. See <a href="/help/features/usage-sync">Usage sync</a>.
        </li>
        <li>
          <strong>Audit log</strong> — who changed what. See{" "}
          <a href="/help/features/audit-log">Audit log</a>.
        </li>
      </ul>

      <Callout variant="info" title="The sandbox default moved">
        &ldquo;Include sandbox traffic in reports&rdquo; used to sit on this page, one screen away
        from the per-account·API rules that override it. It now sits at the top of{" "}
        <a href="/help/features/sandbox-controls">Sandbox billing</a>, so the whole precedence
        chain — app-wide default, account-wide rule, per-API rule — reads top to bottom on one
        page. The on-demand data refresh moved to Data &amp; sync for the same reason: the run
        history it reports against is already there.
      </Callout>

      <H2 id="what-you-can-do">What you can do</H2>
      <ul>
        <li>
          <strong>Set an email list</strong> — save recipients, send yourself a test, or send the
          real digest immediately without waiting for the cron.
        </li>
        <li>
          <strong>Move between tabs</strong> — the strip shows only the tabs your role can open.
        </li>
      </ul>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Editors</strong> — see no Settings entry. Their work is in the Review section:
          aliases, API review, manual entries, sandbox rules.
        </li>
        <li>
          <strong>Old links</strong> — every tab route is unchanged, so bookmarks and notification
          deep-links still work.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/usage-sync", label: "Usage sync" },
          { href: "/help/features/user-management", label: "User management" },
          { href: "/help/features/sandbox-controls", label: "Sandbox controls" },
          { href: "/help/features/navigation", label: "Navigation" },
        ]}
      />
    </>
  );
}
