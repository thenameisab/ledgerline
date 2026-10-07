import type { Metadata } from "next";
import { DocPage } from "@/components/help/DocPage";
import {
  H2,
  H3,
  Callout,
  CodeBlock,
  FilePath,
  ParamTable,
  Related,
} from "@/components/help/doc";

export const metadata: Metadata = { title: "Built with Claude Code" };

export default function BuiltWithClaudeCodePage() {
  return (
    <DocPage
      title="Built with Claude Code"
      meta={
        <>
          <span className="rounded-full bg-accent-bg px-2.5 py-1 text-[11px] font-medium text-accent-ink">
            AI-assisted engineering
          </span>
          <span className="rounded-full bg-bg-sunken px-2.5 py-1 text-[11px] font-medium text-ink-muted">
            Agentic workflow
          </span>
        </>
      }
      lede="Ledgerline was designed and built with Claude Code, the agentic command-line tool from Anthropic. This page describes the workflow, the checks that every change had to pass, and one worked example."
    >
      <p>
        I give the agent a precise goal and the context it needs to reach it. I ask for a plan
        before any code changes, and I check each claim against something that runs. The model
        writes most of the code. I own the architecture, the acceptance criteria, and the decision
        that a change is complete.
      </p>

      <Callout variant="tip" title="About this page">
        This page and the demo you are using were written in Claude Code sessions. The same
        sessions set up the embedded database, the seed data, and the browser checks.
      </Callout>

      {/* ─────────────────────────────────────────────── workflow */}
      <H2 id="workflow">The workflow</H2>
      <p>
        Each change that is larger than a few lines follows the same four steps. The steps put
        planning before typing, because the costly errors come from an agent that builds the wrong
        thing with confidence.
      </p>

      <H3 id="understand">1 · Read the code first</H3>
      <p>
        Before any edit, the agent reads the code paths, patterns, and conventions that the change
        touches. For wide questions I start several read-only{" "}
        <strong>exploration sub-agents in parallel</strong>, each on one area, and keep only their
        conclusions. This gives a working summary of the codebase (more than 40 API routes and 30
        repository modules) in a few minutes.
      </p>

      <H3 id="plan">2 · Write a plan and approve it</H3>
      <p>
        The agent writes an implementation plan that lists the approach, the files it will change,
        and the risks. I approve or change the plan <em>before</em> any code changes. Architecture
        decisions happen at this step, for example the choice of an embedded database instead of
        Docker for the local setup. A decision is easier to change in a plan than in a diff.
      </p>

      <H3 id="implement">3 · Make small, reviewable changes</H3>
      <p>
        Each edit touches only what the task needs and matches the style of the surrounding code.
        Changes stay small enough that I can read the whole diff and connect each line to the goal.
      </p>

      <H3 id="verify">4 · Check the result</H3>
      <p>
        A change is complete only when something that runs confirms it: a type-check, a query
        result, or a rendered page. The <a href="#guardrails">Checks</a> section lists them.
      </p>

      {/* ─────────────────────────────────────────────── techniques */}
      <H2 id="techniques">Techniques</H2>

      <ParamTable
        nameHeader="Technique"
        rows={[
          {
            name: "Parallel sub-agents",
            type: "explore",
            desc: "Several read-only agents run at the same time, each on a different subsystem. Their findings are combined instead of reading files one by one.",
          },
          {
            name: "Plan approval",
            type: "control",
            desc: "No implementation starts until a plan is approved. The costly decisions happen first, when they are easy to change.",
          },
          {
            name: "Specs in the repo",
            type: "context",
            desc: "Design documents and notes on known issues live in the repo, so the agent has the same context in every session.",
          },
          {
            name: "Deterministic seed",
            type: "verify",
            desc: "A seeded random number generator makes the fictional data the same on every run. A difference between runs is a real bug.",
          },
          {
            name: "Self-review",
            type: "verify",
            desc: "After a change, the agent looks for cases that break it: edge cases, null values, and date boundaries.",
          },
          {
            name: "Persistent memory",
            type: "context",
            desc: "Notes on decisions and known problems carry over between sessions, so the agent does not have to learn them again.",
          },
        ]}
      />

      {/* ─────────────────────────────────────────────── example */}
      <H2 id="example">Worked example: a demo that runs anywhere</H2>
      <p>
        Ledgerline had to run with <strong>one command and no external accounts</strong>, and
        keep every feature. That requirement led to these decisions:
      </p>

      <ParamTable
        nameHeader="Decision"
        rows={[
          {
            name: "Embedded Postgres",
            type: "no Docker",
            desc: "npm run dev starts a real Postgres binary, so the revenue view and the exact NUMERIC math behave the same as on a hosted database.",
          },
          {
            name: "One baseline migration",
            type: "0001",
            desc: "The full schema is in migrations/0001_baseline.sql. A new database applies this one file.",
          },
          {
            name: "Fictional seed data",
            type: "first run",
            desc: "On an empty database the launcher applies the schema and seeds about three months of fictional accounts, SKUs, vendors, usage, and invoices. The public demo runs the same reseed every night.",
          },
          {
            name: "Mocked integrations",
            type: "MOCK_INTEGRATIONS",
            desc: "The usage sync and the vendor usage pull read local data. With no mail credentials set, email sends do nothing, and ?dry=1 renders a preview.",
          },
        ]}
      />

      <CodeBlock
        title="package.json: one command starts everything"
        lang="json"
        code={`"scripts": {
  "dev": "tsx scripts/local.ts dev"   // embedded Postgres → setup and seed if empty → next dev
}`}
      />

      <Callout variant="info" title="A bug the checks found">
        Finalizing an invoice failed, but only on the first day of a month. The seed put unmapped
        usage rows in the last few days. On the 1st, those days fall in a <em>finalized</em>{" "}
        period, which produced a statement line with no SKU code. Mid-month the bug did not
        appear. A browser check on the 1st found it. The fix keeps those rows in the current open
        period.
      </Callout>

      {/* ─────────────────────────────────────────────── guardrails */}
      <H2 id="guardrails">Checks</H2>
      <p>
        A model can report that something works when it does not. Each change in this project
        passed at least one of these checks:
      </p>
      <ParamTable
        nameHeader="Check"
        rows={[
          {
            name: "Type-check",
            type: "tsc --noEmit",
            desc: "Finds missing imports and type errors before anything runs.",
          },
          {
            name: "Palette queries",
            type: "npm run check:cmd",
            desc: "Runs assertions on the command palette query parser and exits with an error if one fails.",
          },
          {
            name: "Name scan",
            type: "npm run check:names",
            desc: "Scans the source for names that must not appear in a public demo.",
          },
          {
            name: "Database queries",
            type: "SQL",
            desc: "Queries against the seeded database confirm that the expected rows exist, for example both tiered and slab pricing, and that sandbox rules change the revenue view.",
          },
          {
            name: "Browser checks",
            type: "rendered UI",
            desc: "Key pages are opened in a real browser and captured as screenshots: the dashboard, an account profile, pricing, and sign-in.",
          },
          {
            name: "Full build",
            type: "next build",
            desc: "A full build confirms that every route compiles and renders on the server.",
          },
        ]}
      />
      <p>
        The same rules are in the repo&apos;s <FilePath>CLAUDE.md</FilePath>, so the agent reads
        them in every session: think before coding, use the simplest approach that works, make
        small changes, and turn each task into a goal that can be checked.
      </p>

      {/* ─────────────────────────────────────────────── stack */}
      <H2 id="stack">The stack</H2>
      <p>
        Ledgerline is a <strong>Next.js 14</strong> App Router application in TypeScript. It reads
        and writes <strong>Postgres</strong> through typed repository modules that use raw SQL. One
        revenue view applies pricing, vendor cost, bundles, and sandbox rules to each usage row.
        Money stays an exact <code>NUMERIC</code> value from the database to the invoice through{" "}
        <FilePath>src/lib/money.ts</FilePath>. Invoices export to PDF and CSV. The UI uses design
        tokens on Tailwind, Recharts for charts, and a command palette. Other pages in this
        handbook document the architecture, the math, and each endpoint.
      </p>

      <Callout variant="tip" title="What this project shows">
        Working well with an AI agent means splitting work into goals that can be checked, giving
        the agent the right context and limits, and keeping an engineer responsible for
        correctness. The same workflow applies to other codebases.
      </Callout>

      <Related
        links={[
          { href: "/help/architecture", label: "System architecture" },
          { href: "/help/math", label: "The mathematics" },
          { href: "/help/changelog", label: "Build-by-build changelog" },
        ]}
      />
    </DocPage>
  );
}
