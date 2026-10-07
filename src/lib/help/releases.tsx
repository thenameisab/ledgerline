import type { ReleaseNote } from "./types";

/**
 * Ledgerline release notes, newest first. Each entry describes one feature
 * group of the public demo.
 */
export const releases: ReleaseNote[] = [
  {
    build: 5,
    date: "2026-10-06",
    title: "Ledgerline public demo",
    milestone: true,
    milestoneLabel: "Public demo",
    highlights: [
      <>
        The demo is open to visitors. A visitor signs in with an email address and a one-time
        code, then selects <strong>Enter as Admin</strong> or <strong>Enter as Member</strong>.
      </>,
      <>
        All accounts, APIs, vendors, and amounts are fictional. The database resets every night,
        so changes that visitors make stay until the next reset.
      </>,
      <>
        The usage sync and the vendor usage pull are simulated. Email sends are turned off. The
        digest routes accept <code>?dry=1</code>, which renders the email without sending it.
      </>,
    ],
    technical: [
      <>
        A fresh database applies one migration, <code>migrations/0001_baseline.sql</code>, and
        then loads the seed data.
      </>,
      <>
        A nightly job reseeds the database and clears the revenue cache through{" "}
        <code>/api/cache/revalidate</code>. The call needs the <code>CRON_SECRET</code> bearer
        token.
      </>,
      <>
        <code>MOCK_INTEGRATIONS=true</code> replaces the external usage sources with local data.
      </>,
    ],
  },
  {
    build: 4,
    date: "2026-10-05",
    title: "Command palette",
    highlights: [
      <>
        Press <code>⌘K</code> to search accounts, APIs, invoices, vendors, and pages from any
        screen.
      </>,
      <>
        The palette accepts filters such as <code>field:value</code>, shows recent items, and
        offers actions that match your role.
      </>,
    ],
  },
  {
    build: 3,
    date: "2026-10-04",
    title: "Alerts and digests",
    highlights: [
      <>
        The <strong>Alerts</strong> page lists usage changes by severity and groups them by
        account. Each account shows a short usage trend.
      </>,
      <>
        Daily, weekly, and monthly revenue digests summarize usage and revenue. Admins choose the
        recipients in Settings.
      </>,
      <>The notifications panel groups recent events by day.</>,
    ],
  },
  {
    build: 2,
    date: "2026-10-03",
    title: "Vendor cost and reconciliation",
    highlights: [
      <>
        Each API can have a vendor and a vendor rate. Ledgerline uses the rate to calculate the
        cost and the margin for each usage row.
      </>,
      <>
        Reconciliation compares the usage that Ledgerline records with the usage that the vendor
        reports, and shows the days where the two counts differ.
      </>,
      <>Each margin figure states how much of the usage has a vendor rate.</>,
    ],
  },
  {
    build: 1,
    date: "2026-10-01",
    title: "Pricing and invoices",
    milestone: true,
    milestoneLabel: "Billing core",
    highlights: [
      <>
        Set a price for each API on each account. The pricing models are flat, tiered
        (graduated), slab (whole volume), and bundles that bill several APIs as one line.
      </>,
      <>
        Prices have effective dates. A price change applies from a chosen day, and earlier usage
        keeps its earlier price.
      </>,
      <>
        Invoices are calculated from usage, pricing, manual entries, and sandbox rules. You can
        review a draft, finalize it, and export it as PDF or CSV.
      </>,
      <>
        Aliases map unknown usage names to known accounts and APIs. Roles control access: admins
        manage everything, editors change pricing and catalog data, and members can only read.
      </>,
    ],
    technical: [
      <>
        Money uses exact <code>NUMERIC</code> values from the database to the invoice, through{" "}
        <code>src/lib/money.ts</code>.
      </>,
    ],
  },
];
