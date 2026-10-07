import type { GuideMeta } from "../types";
import { H2, Steps, Step, Callout, Figure, Related } from "@/components/help/doc";

export const meta: GuideMeta = {
  slug: "filter-by-date-range",
  title: "Filter by date range & sandbox",
  summary: "Change the reporting window with presets or custom dates, and control whether sandbox traffic counts.",
  group: "Daily work",
  role: "all",
  minutes: 2,
};

export default function Body() {
  return (
    <>
      <p>
        The dashboard and account detail pages share one date-range picker. Every KPI, chart, and
        table on the page recomputes for the window you choose, and the range is kept in the URL so
        links you share show the same numbers.
      </p>

      <H2 id="range">Change the date range</H2>
      <Steps>
        <Step title="Open the range picker">
          Click the date-range control under the page title. The current preset (or custom range)
          is shown on the button.
        </Step>
        <Step title="Pick a preset">
          Presets cover the common windows: the current month-to-date (e.g. “June 2026 (MTD)”),
          <strong> Last week</strong>, the previous calendar month, <strong>Last 7 days</strong>,{" "}
          <strong>Last 30 days</strong>, and <strong>Last 60 days</strong>.
        </Step>
        <Step title="Or set a custom window">
          Choose <strong>Custom</strong>, set the from/to dates, and click <strong>Apply</strong>.
        </Step>
      </Steps>
      <Callout variant="info">
        Month-over-month comparison chips always compare against the prior month day-scaled,
        regardless of the window you pick — so a 7-day view still shows a fair delta.
      </Callout>

      <H2 id="sandbox">Include or exclude sandbox traffic</H2>
      <p>
        Sandbox accounts are excluded from all KPIs, charts, and account lists by default. The toggle
        lives in admin settings, and applies app-wide:
      </p>
      <Steps>
        <Step title="Open Admin → General">
          In the sidebar, expand <strong>Configuration</strong> and click <strong>General</strong>{" "}
          (admins only).
        </Step>
        <Step title="Flip “Include sandbox traffic in reports”">
          The setting persists in your browser. The dashboard subtitle reflects it — “sandbox
          included” or “sandbox excluded”.
        </Step>
      </Steps>

      <Figure
        src="/help/shots/admin-settings.png"
        alt="The admin General settings page with the sandbox toggle"
        caption="The sandbox toggle on Admin → General."
      />

      <Related
        links={[
          { href: "/help/guides/read-the-dashboard", label: "Read the dashboard" },
          { href: "/help/guides/investigate-an-account", label: "Investigate an account" },
        ]}
      />
    </>
  );
}
