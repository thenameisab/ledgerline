import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Kbd, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "ask-the-palette",
  title: "Ask the palette a question",
  summary:
    "Type a question into ⌘K to get a revenue, hits, or unpriced figure inline — plus explain a change and follow relations.",
  group: "Daily work",
  role: "all",
  minutes: 3,
};

export default function Body() {
  return (
    <>
      <p>
        The command palette can answer a question without making you navigate. Type a question
        and the number appears inline, reconciled with the dashboard and account pages, with a link
        to drill into the real page.
      </p>

      <Figure
        src="/help/shots/command-palette-ask.png"
        alt="The command palette answering a question inline"
        caption="Ask mode answers inline — the figure, the assumptions, and a drill-down link."
      />

      <H2 id="ask">Ask for a number</H2>
      <Steps>
        <Step title="Open ⌘K and phrase a question">
          A leading <Kbd>?</Kbd> always means ask, but you rarely need it: a question word
          (&ldquo;how much…&rdquo;, &ldquo;top 5…&rdquo;) or a metric word — <code>revenue</code>,{" "}
          <code>hits</code>, <code>unpriced</code> — switches to ask mode on its own. A plain name
          stays a search, so jumping is never hijacked.
        </Step>
        <Step title="Read the answer card">
          The figure shows large, with one line of provenance (<em>account · period · metric</em>)
          and the assumptions used — the period and whether sandbox traffic is included.
        </Step>
        <Step title="Drill in">
          Every answer carries a <strong>drill-down</strong> link to the page behind it — the
          account, the group, or the dashboard — so the number is always one click from its
          source.
        </Step>
      </Steps>

      <H2 id="what-it-answers">What it can answer</H2>
      <ul>
        <li>
          <strong>Revenue</strong> — <em>&ldquo;revenue for Acme in May&rdquo;</em>,{" "}
          <em>&ldquo;total revenue last month&rdquo;</em>, <em>&ldquo;top 5 accounts&rdquo;</em>,{" "}
          <em>&ldquo;revenue for the Acme account&rdquo;</em>.
        </li>
        <li>
          <strong>Hits</strong> — <em>&ldquo;how many hits did Acme do in May?&rdquo;</em>
        </li>
        <li>
          <strong>Unpriced</strong> — <em>&ldquo;unpriced&rdquo;</em> lists the accounts with the
          most traffic billing at zero.
        </li>
      </ul>
      <p>
        Periods parse naturally: <em>May</em>, <em>May 2026</em>, <em>last month</em>. With no
        period named, the answer is month-to-date.
      </p>

      <H2 id="explain">Explain a change</H2>
      <p>
        Ask <em>&ldquo;why did Acme change vs last month?&rdquo;</em> and the palette diffs the two
        periods, attributing the difference across the factors that moved it: volume per API, price
        changes, slab-tier crossings, bundle stitching, and API code remaps.
      </p>

      <H2 id="relate">Follow a relationship</H2>
      <p>
        Ask <em>&ldquo;accounts using KY1001&rdquo;</em> to see who consumes an API, or{" "}
        <em>&ldquo;APIs used by Acme&rdquo;</em> to see what an account consumes. On an API or account
        page, the same jumps appear in the <strong>On this page</strong> strip.
      </p>

      <Callout variant="info">
        Ask covers revenue, hits, and unpriced across every account. It also
        deliberately doesn&rsquo;t answer per-account margin — that needs vendor allocation Ledgerline
        doesn&rsquo;t model yet. If a question isn&rsquo;t one it handles, it says so and suggests a
        phrasing rather than guessing.
      </Callout>

      <Related
        links={[
          { href: "/help/guides/command-palette", label: "Find anything with the command palette" },
          { href: "/help/guides/fix-unpriced-traffic", label: "Fix unpriced traffic" },
          { href: "/help/features/command-palette", label: "Command palette (feature)" },
        ]}
      />
    </>
  );
}
