import type { FeatureMeta } from "../types";
import { H2, Figure, Kbd, Callout, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "command-palette",
  title: "Command palette & keyboard shortcuts",
  summary:
    "Press ⌘K to search every entity, run actions, and ask for a number — one box that detects whether you're searching, doing, or asking.",
  group: "Platform",
  role: "all",
  routes: [],
};

export default function Body() {
  return (
    <>
      <p>
        <Kbd>⌘K</Kbd> (or <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd>) opens the command palette from any screen.
        It is no longer just a launcher: one input detects what you&rsquo;re doing and switches
        between three modes — <strong>search</strong> any entity, <strong>act</strong> on it, or{" "}
        <strong>ask</strong> for a number — without you choosing a mode first.
      </p>

      <Figure
        src="/help/shots/command-palette.png"
        alt="The command palette open over the dashboard with grouped results"
        caption="One box, three modes — search results, runnable actions, and inline answers."
      />

      <H2 id="ask-me">Ask Me — guided questions</H2>
      <p>
        The palette can answer a lot, but only if you already know how to phrase it. Press{" "}
        <Kbd>Tab</Kbd> from an empty box and it switches to <strong>Ask Me</strong>: the placeholder
        starts typing example questions out, and below it you get a list of half-written questions
        with holes to fill.
      </p>
      <p>
        Pick <em>&ldquo;Revenue for … in …&rdquo;</em> and it asks you for the account — from the
        real list of accounts, not a free-text guess — then optionally a month. Pick{" "}
        <em>&ldquo;Accounts using …&rdquo;</em> and it offers the API catalogue. You never have to know the
        wording, and every value on offer is one that actually exists.
      </p>
      <ul>
        <li>
          <Kbd>↵</Kbd> picks the highlighted cue or value · <Kbd>Tab</Kbd> skips an optional step
          (the period then defaults to month-to-date) · <Kbd>⌫</Kbd> on an empty box steps back a
          step · <Kbd>esc</Kbd> steps back, and only leaves Ask Me once you&rsquo;re at the top.
        </li>
        <li>
          The question so far sits as a chip in the input row — click it to step back.
        </li>
        <li>
          Typing filters the current step&rsquo;s values. While a question is being built the normal
          results stand down, so there&rsquo;s never a half-written question and a list of accounts
          competing for the same <Kbd>↵</Kbd>.
        </li>
      </ul>
      <Callout variant="info">
        <Kbd>Tab</Kbd> only opens Ask Me from an <em>empty</em> box. With text in there it would
        throw away what you typed, and <Kbd>Tab</Kbd> still has to reach the filter chips for
        keyboard users.
      </Callout>
      <p>
        Because you picked the account from a list, a cue-built question is sent as a{" "}
        <strong>structured request</strong> rather than a sentence. That matters: the prose parser
        strips common words to find the entity, so an account called <em>Total Finance</em> would
        lose &ldquo;Total&rdquo; on the way in. Cues skip that step entirely and send the exact name.
      </p>

      <H2 id="operators">Operators — narrow the search</H2>
      <p>
        Plain text still works exactly as before. When you need to be precise, the box takes the
        operators you already know from GitHub and Linear:
      </p>
      <ul>
        <li>
          <code>field:value</code> scopes to one field — <code>account:acme</code>,{" "}
          <code>api:KY1001</code>, <code>status:pending</code>,{" "}
          <code>month:june</code>, <code>user:maya</code>, <code>type:invoice</code>.
        </li>
        <li>
          <code>is:</code> and <code>in:</code> read more naturally inline —{" "}
          <code>is:pending</code>, <code>in:june</code> — and mean <code>status:</code> and{" "}
          <code>month:</code>.
        </li>
        <li>
          <code>@acme</code> is short for <code>account:</code>, <code>#KY1001</code> for{" "}
          <code>api:</code>.
        </li>
        <li>
          <code>-sandbox</code> excludes a term. Quote a value with spaces:{" "}
          <code>account:&quot;northwind finance&quot;</code>.
        </li>
      </ul>
      <p>
        Each active operator appears as a chip above the results — click one to drop just that
        filter and keep the rest of the query. Operators also decide <em>which</em> corpus is
        searched: a bare <code>status:pending</code> looks only where that word means something
        (manual entries, invoices, people), instead of matching every account against an
        empty string.
      </p>
      <Callout variant="info">
        Because operators mean &ldquo;narrow a list&rdquo;, a query using them stays in search even
        when it also contains a metric word — <code>status:pending revenue</code> filters, it
        doesn&rsquo;t flip to ask and silently drop your filter.
      </Callout>

      <H2 id="views">Views — jump to a filtered list</H2>
      <p>
        Every list page in Ledgerline takes filter params, so the palette treats a filtered list as a
        destination in its own right. Type <em>&ldquo;leaking&rdquo;</em>,{" "}
        <em>&ldquo;pending&rdquo;</em>, <em>&ldquo;inactive&rdquo;</em> and a{" "}
        <strong>Views</strong> group offers the filtered page directly — accounts with revenue
        leak, entries awaiting approval, APIs with no traffic. Operators compose into views too:{" "}
        <code>user:</code> becomes that person&rsquo;s audit trail.
      </p>

      <H2 id="modes">The three modes</H2>
      <ul>
        <li>
          <strong>Search</strong> (default) — type a name or code. Mode is detected from what you
          type; nothing to toggle.
        </li>
        <li>
          <strong>Act</strong> — start with <Kbd>&gt;</Kbd>, or just type a verb (
          <em>&ldquo;refresh&rdquo;</em>, <em>&ldquo;create account&rdquo;</em>). Matching actions
          also surface alongside search results.
        </li>
        <li>
          <strong>Ask</strong> — start with <Kbd>?</Kbd>, or phrase a question (
          <em>&ldquo;revenue for Acme in May&rdquo;</em>). A metric word like{" "}
          <code>revenue</code>, <code>hits</code>, or <code>unpriced</code> is enough to trigger it.
          Plain entity names stay in search so jumping is never hijacked.
        </li>
      </ul>

      <H2 id="search">Search — every entity, with metadata</H2>
      <p>As you type (debounced 180&nbsp;ms), results group by type with at-a-glance detail:</p>
      <ul>
        <li>
          <strong>Accounts</strong> — revenue, a <em>sandbox</em> chip, and an <em>n unpriced</em>{" "}
          warning when traffic is leaking. Renamed accounts are still findable by their old name; the
          row says <em>formerly …</em> so the match doesn&rsquo;t look like a bug.
        </li>
        <li>
          <strong>Invoices</strong> — account · period, with total, margin %, and a status dot
          (draft / final / issued).
        </li>
        <li>
          <strong>Groups</strong> — account count and rolled-up revenue.
        </li>
        <li>
          <strong>APIs</strong> — name and product code.
        </li>
        <li>
          <strong>Manual entries</strong> — account · date, total, and status (draft / pending /
          approved / void).
        </li>
        <li>
          <strong>Billing periods</strong> — a month is somewhere you navigate to, with how many
          invoices are cut for it and how many are still draft.
        </li>
        <li>
          <strong>People</strong> — teammates by name, email, role, or job title, with invite status
          (admins only).
        </li>
        <li>
          <strong>Vendor costs</strong> and <strong>Audit</strong> — admins only.
        </li>
        <li>
          <strong>Help</strong> — feature docs and how-to guides whose title, summary, or group
          match the query, each opening straight to <code>/help/features/…</code> or{" "}
          <code>/help/guides/…</code>. Admin-only docs are filtered out for everyone else.
        </li>
      </ul>
      <p>
        <strong>Pages</strong> and the admin books (<strong>Review</strong>,{" "}
        <strong>Settings</strong>) round out the list. Both mirror the sidebar exactly — same
        entries, same roles — so the palette never offers a destination that
        would only redirect you. The admin books show in the empty state; once you type, the{" "}
        <strong>Actions</strong> group covers the same routes as searchable verbs. Status is always
        a colour dot <em>plus</em> a label — never colour alone.
      </p>

      <H2 id="actions">Act — run verbs from the palette</H2>
      <p>
        Actions either run inline or jump to the form that <em>is</em> the action — we only list
        complete affordances, never a page where you still have to hunt for a button.
      </p>
      <ul>
        <li>
          <strong>Refresh usage data</strong> runs inline and toasts the result (admin).
        </li>
        <li>
          <strong>Create account / group / manual entry</strong>, <strong>Resolve aliases</strong>,{" "}
          <strong>Review API catalog</strong>, <strong>Set sandbox billing rules</strong> — the
          customisation work admins and <em>editors</em> both own.
        </li>
        <li>
          <strong>Invite user</strong>, <strong>Review approvals</strong>,{" "}
          <strong>Set vendor cost</strong>, <strong>Backfill usage</strong>, <strong>Open audit log</strong>,{" "}
          <strong>Manage email digests</strong> — admin-only configuration.
        </li>
      </ul>
      <Callout variant="info">
        Verbs are filtered by role, so an editor sees the customisation set, a member sees neither —
        but that&rsquo;s a UX gate mirroring <code>lib/access.ts</code>. Every target route and API
        still enforces the real permission check server-side.
      </Callout>

      <H2 id="on-this-page">On this page — context-aware actions</H2>
      <p>
        Open the palette on an entity route and it leads with a scoped strip for what you&rsquo;re
        looking at:
      </p>
      <ul>
        <li>
          <strong>Account</strong> — Add manual entry, Edit pricing, Edit profile, View invoices,
          and &ldquo;APIs used by this account&rdquo;.
        </li>
        <li>
          <strong>Invoice</strong> — Export PDF, Export CSV (variant follows your role), Add manual
          entry, Edit pricing, Edit profile.
        </li>
        <li>
          <strong>API</strong> — &ldquo;Accounts using this API&rdquo;.
        </li>
      </ul>
      <p>
        The editing entries appear only for admins and editors: pricing, profile, and the
        manual-entry wizard all guard on a permission, so a member gets the read-only subset
        (invoice exports, invoice list, the ask shortcuts) instead of a verb that redirects.
      </p>

      <H2 id="ask">Ask — a number, inline</H2>
      <p>
        Ask mode answers from the same cached summaries the dashboard uses, so the figure
        reconciles exactly. It covers <strong>revenue</strong>, <strong>hits</strong>, and{" "}
        <strong>unpriced</strong> — for an account, a group, the top N accounts, or the whole org —
        and parses periods like <em>&ldquo;May&rdquo;</em>, <em>&ldquo;May 2026&rdquo;</em>, or{" "}
        <em>&ldquo;last month&rdquo;</em> (default is month-to-date).
      </p>
      <ul>
        <li>
          <strong>Explain</strong> — <em>&ldquo;why did Acme change vs last month?&rdquo;</em>{" "}
          attributes the delta across volume, price, slab tiers, bundles, and code remaps.
        </li>
        <li>
          <strong>Relate</strong> — <em>&ldquo;accounts using KY1001&rdquo;</em> or{" "}
          <em>&ldquo;APIs used by Acme&rdquo;</em>.
        </li>
      </ul>
      <p>
        The answer card shows the figure (the one place the palette uses a serif landmark), the
        period and sandbox assumptions, and a <em>drill-down</em> link to the real page — never a
        dead end.
      </p>

      <H2 id="expand">The panel grows to fit the answer</H2>
      <p>
        An answer isn&rsquo;t always one number. Ask for an account&rsquo;s revenue and you also get
        its daily line and its top APIs; ask for the top 5 and you get a ranked table with hits
        alongside revenue. When an answer carries a chart, or a breakdown long enough to deserve a
        real table, the palette <strong>expands in both axes</strong> — from a 560&nbsp;px list to an
        880&nbsp;px panel, and taller — and animates there over 220&nbsp;ms on the design
        system&rsquo;s expo curve.
      </p>
      <p>
        It&rsquo;s a CSS transition rather than a keyframe, so a query that changes shape mid-flight
        interrupts cleanly instead of finishing the old animation first. The chart is hand-rolled
        SVG for the same reason the sparklines are: a charting library&rsquo;s mount cost is the one
        thing that would make the resize stutter. Under{" "}
        <code>prefers-reduced-motion</code> the panel snaps to its new size instead.
      </p>
      <Callout variant="info">
        Margin questions aren&rsquo;t answered —
        per-account margin needs vendor allocation we don&rsquo;t model yet. An optional LLM fallback for unusual phrasings is off unless{" "}
        <code>ASK_LLM_ENABLED</code> and an API key are configured; it only fills a constrained
        query spec, never raw SQL.
      </Callout>

      <H2 id="recents">Recents</H2>
      <p>
        With an empty box, the palette shows what you last opened — seeded from browsing (opening
        the palette on an entity page remembers it), not just past palette picks. Recents live in
        the browser and the page you&rsquo;re currently on is omitted, since &ldquo;On this
        page&rdquo; already covers it.
      </p>

      <H2 id="shortcuts">Global shortcuts</H2>
      <ul>
        <li>
          <Kbd>⌘1</Kbd> Dashboard · <Kbd>⌘2</Kbd> Accounts · <Kbd>⌘3</Kbd> APIs ·{" "}
          <Kbd>⌘4</Kbd> Manual entries
        </li>
        <li>
          <Kbd>⌘[</Kbd> back · <Kbd>⌘]</Kbd> forward — browser-style history from the keyboard
        </li>
        <li>
          <Kbd>⌘K</Kbd> command palette (the sidebar&rsquo;s search button opens the same overlay)
        </li>
      </ul>
      <p>
        <Kbd>Ctrl</Kbd> substitutes for <Kbd>⌘</Kbd> on Windows and Linux throughout. Footer hints
        in the palette show <Kbd>↑</Kbd><Kbd>↓</Kbd> navigate · <Kbd>↵</Kbd> open · <Kbd>esc</Kbd>{" "}
        close · <Kbd>:</Kbd> filter · <Kbd>&gt;</Kbd> actions · <Kbd>?</Kbd> ask.
      </p>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>While typing in a field</strong> — navigation shortcuts stay quiet so they never
          hijack a form; <Kbd>esc</Kbd> is handled by whichever modal is open.
        </li>
        <li>
          <strong>Member pressing ⌘4</strong> — Manual entries needs edit rights, so the palette
          doesn&rsquo;t list it for members; pressing the shortcut anyway redirects rather than
          showing an error.
        </li>
        <li>
          <strong>No results</strong> — the palette suggests a next step (an account, invoice, API
          code, or a question) rather than a bare &ldquo;0 results&rdquo;; ask mode always shows a
          loading row, an answer, or a hint — never a blank panel.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/guides/command-palette", label: "Find anything with the command palette" },
          { href: "/help/guides/ask-the-palette", label: "Ask the palette a question" },
          { href: "/help/features/searchable-dropdowns", label: "Searchable dropdowns" },
          { href: "/help/features/navigation", label: "Sidebar & navigation" },
        ]}
      />
    </>
  );
}
