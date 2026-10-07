import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Kbd, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "command-palette",
  title: "Find anything with the command palette",
  summary:
    "Search every entity, jump to a page, and run actions from the keyboard with ⌘K and the number shortcuts.",
  group: "Getting started",
  role: "all",
  minutes: 3,
};

export default function Body() {
  return (
    <>
      <p>
        The command palette is the fastest way to move around Ledgerline. One box searches every
        entity, runs actions, and answers questions — it detects which you mean from what you type,
        so there&rsquo;s no mode to pick.
      </p>

      <Figure
        src="/help/shots/command-palette.png"
        alt="The command palette open over the dashboard, showing grouped results"
        caption="Results group into Accounts, Invoices, Groups, SKUs, Pages, and more."
      />

      <H2 id="open">Open and search</H2>
      <Steps>
        <Step title="Press ⌘K (Ctrl+K on Windows/Linux)">
          The palette opens on top of whatever page you are on. Clicking the search box at the top
          of the sidebar does the same thing.
        </Step>
        <Step title="Type a name, group, SKU code, or invoice">
          Results group under <strong>Accounts</strong>, <strong>Invoices</strong>,{" "}
          <strong>Groups</strong>, <strong>SKUs</strong>, and <strong>Manual entries</strong>,
          each row carrying its revenue, status, and other at-a-glance detail. Search is debounced,
          so results settle a beat after you stop typing.
        </Step>
        <Step title="Not sure what to type? Press Tab">
          From an empty box, <Kbd>Tab</Kbd> switches on <strong>Ask Me</strong>. The box starts
          typing out example questions, and a list of half-written ones appears below — pick{" "}
          <em>&ldquo;Revenue for … in …&rdquo;</em> and it walks you through choosing the account and
          the month from real lists. <Kbd>⌫</Kbd> steps back, <Kbd>Tab</Kbd> skips an optional step.
        </Step>
        <Step title="Narrow it with an operator">
          Add <code>field:value</code> to scope the search — <code>account:copperleaf</code>,{" "}
          <code>is:pending</code>, <code>in:june</code>,{" "}
          <code>type:invoice</code>. <code>@name</code> and <code>#CODE</code> are shorthand for
          account and SKU; <code>-word</code> excludes a term. Each one shows as a chip you can click
          to remove.
        </Step>
        <Step title="Or jump straight to a filtered list">
          Type a state instead of a name — <em>leaking</em>, <em>pending</em>, <em>inactive</em> — and a <strong>Views</strong> group offers the filtered page itself,
          rather than making you open the list and set the filter by hand.
        </Step>
        <Step title="Or find a help doc">
          The same box searches this help centre — a <strong>Help</strong> group surfaces
          matching feature docs and how-to guides alongside your entity results, so you never have
          to leave the keyboard to look something up.
        </Step>
        <Step title="Navigate and select">
          Use <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move, <Kbd>↵</Kbd> to open the highlighted result, and{" "}
          <Kbd>esc</Kbd> to close without navigating.
        </Step>
      </Steps>

      <H2 id="recents">Start from where you left off</H2>
      <p>
        Open the palette with an empty box and it shows <strong>Recent</strong> — the accounts,
        invoices, and SKUs you last opened, most recent first. It remembers from browsing, not just
        from past palette picks, so the entities you actually work on are one keystroke away.
      </p>

      <H2 id="actions">Run an action</H2>
      <Steps>
        <Step title="Type > or a verb">
          A leading <Kbd>&gt;</Kbd> lists every action you can run; or just type a verb like{" "}
          <em>refresh</em> or <em>create account</em> and matching actions appear alongside search
          results.
        </Step>
        <Step title="Select it">
          <strong>Refresh usage</strong> runs inline and toasts the result. Create flows, invites, vendor costs, alias resolution, SKU
          review, sandbox rules, approvals, the audit log, and settings open their form or tool,
          ready to go. You only ever see the verbs your role can actually run.
        </Step>
      </Steps>

      <H2 id="on-this-page">Act on the page you&rsquo;re viewing</H2>
      <p>
        Open the palette on an account, invoice, or SKU and it leads with an{" "}
        <strong>On this page</strong> strip — scoped shortcuts for exactly what you&rsquo;re looking
        at: export an invoice&rsquo;s PDF or CSV, add a manual entry, edit pricing or the profile,
        jump to its relations (&ldquo;SKUs used by this account&rdquo;, &ldquo;accounts using this
        SKU&rdquo;).
      </p>

      <H2 id="shortcuts">Global shortcuts</H2>
      <p>
        These work from anywhere, without opening the palette, and match the sidebar:
      </p>
      <ul>
        <li><Kbd>⌘1</Kbd> — Dashboard</li>
        <li><Kbd>⌘2</Kbd> — Accounts</li>
        <li><Kbd>⌘3</Kbd> — SKUs</li>
        <li><Kbd>⌘4</Kbd> — Manual entries (needs edit rights)</li>
        <li><Kbd>⌘[</Kbd> / <Kbd>⌘]</Kbd> — back / forward</li>
      </ul>

      <Callout variant="tip">
        Want a number rather than a page? The palette answers questions too — see{" "}
        <strong>Ask the palette a question</strong> below.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/ask-the-palette", label: "Ask the palette a question" },
          { href: "/help/guides/investigate-an-account", label: "Investigate an account" },
          { href: "/help/guides/investigate-a-sku", label: "Investigate a SKU" },
        ]}
      />
    </>
  );
}
