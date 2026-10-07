import type { FeatureMeta } from "../types";
import { H2, Callout, Figure, Related } from "@/components/help/doc";

export const meta: FeatureMeta = {
  slug: "api-review",
  title: "API review",
  summary:
    "The code-first triage desk: usage maps to an API by Product Code only, and anything that doesn't — unknown codes, blank codes, name drift, retired codes still in use — surfaces here to accept, override, acknowledge, or reactivate.",
  group: "Admin",
  role: "admin",
  routes: ["/admin/sku-review"],
};

export default function Body() {
  return (
    <>
      <p>
        Ledgerline resolves usage to an API by its <strong>Product Code</strong>, never by name — a
        single stray space in a label can&rsquo;t silently re-bill a product. A row maps only when
        its Product Code is an <em>active</em> catalog entry. Everything that doesn&rsquo;t resolve
        cleanly lands here, one queue per kind of problem, so revenue is never guessed and never
        quietly dropped.
      </p>

      <Figure
        src="/help/shots/admin-api-review.png"
        alt="API review page with four triage queues"
        caption="Four queues — unknown codes, missing codes, name drift, and retired codes still receiving usage."
      />

      <Callout variant="info" title="Why code, not name">
        Names drift constantly upstream (&ldquo;V2&rdquo;, spacing, punctuation), and the same name
        has historically been claimed by more than one code. The Product Code is stable, so it is
        the only match key. A name is kept only as an advisory label — see <em>Name drift</em>{" "}
        below. Accounts have no code, so they still resolve by name in{" "}
        <a href="/help/features/aliases">Aliases</a>.
      </Callout>

      <H2 id="queues">The four queues</H2>
      <ul>
        <li>
          <strong>Unknown codes</strong> — usage arrived with a Product Code that isn&rsquo;t an
          active catalog code (a brand-new code, or one that was retired). Until you act, these hits
          earn nothing. <strong>Accept</strong> a new code into the catalog (then price it), or{" "}
          <strong>reactivate</strong> a code that was retired by mistake.
        </li>
        <li>
          <strong>Missing codes</strong> — usage arrived with a <em>blank</em> Product Code. The
          real fix is upstream in the source, but meanwhile add a durable{" "}
          <strong>override</strong> (raw name → code) so those hits bill correctly going forward and
          any already-quarantined rows backfill.
        </li>
        <li>
          <strong>Name drift</strong> — the code matched, but the name the source used isn&rsquo;t a
          known catalog name or alias. Advisory only: billing is unaffected.{" "}
          <strong>Acknowledge</strong> to record the variant and clear it.
        </li>
        <li>
          <strong>Retired codes with usage</strong> — deactivated codes that still carry usage.
          Their historical revenue is intact, but new incoming usage will quarantine above.{" "}
          <strong>Reactivate</strong> if a code was retired prematurely.
        </li>
      </ul>

      <H2 id="overrides">Overrides are deliberate, not fuzzy</H2>
      <p>
        An override is an explicit, audited <em>raw name → code</em> mapping that the matcher
        consults <strong>only</strong> when a row&rsquo;s Product Code is blank or unknown. It is
        not a return to broad name matching — every entry is a human decision, recorded in the audit
        log. Use it to carry a product whose upstream code is missing until the source is fixed.
      </p>

      <Callout variant="tip" title="Resolution heals retroactively">
        Accepting a code or adding an override backfills the matching quarantined rows, so the fix
        re-attributes historical traffic too — not just future days. Every action is audited
        (<code>catalog.accept_code</code>, <code>catalog.override</code>,{" "}
        <code>catalog.ack_drift</code>) and busts the revenue cache.
      </Callout>

      <H2 id="edges">Behaviour at the edges</H2>
      <ul>
        <li>
          <strong>Nothing to review</strong> — each queue shows an all-clear state; every usage row
          maps to an active catalog code.
        </li>
        <li>
          <strong>Never auto-created</strong> — an unknown code is only ever <em>flagged</em>, never
          turned into a billable catalog row on its own; accepting it is an explicit step, and a
          newly accepted code shows as unpriced until you price it.
        </li>
        <li>
          <strong>Accounts are elsewhere</strong> — unmapped account names stay in{" "}
          <a href="/help/features/aliases">Aliases</a>; this page is APIs only.
        </li>
      </ul>

      <Related
        links={[
          { href: "/help/features/aliases", label: "Aliases (account names)" },
          { href: "/help/features/usage-sync", label: "Usage sync" },
          { href: "/help/features/api-governance", label: "API governance" },
          { href: "/help/guides/resolve-unmapped-names", label: "Guide: resolve unmapped names" },
        ]}
      />
    </>
  );
}
