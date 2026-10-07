import { getSessionUser } from "@/lib/access";
import { signOut } from "@/auth";
import { SideNavItem } from "./SideNavItem";
import { SidebarSearchButton } from "./SidebarSearchButton";
import { SidebarCollapseToggle } from "./SidebarCollapseToggle";
import { UserProfileButton } from "./UserProfileButton";
import {
  mainNav,
  reviewNav,
  vendorsNav,
  settingsTabs,
  SETTINGS_ENTRY,
  HELP_ENTRY,
  type NavEntry,
} from "@/lib/nav-model";
import { getReviewCounts, type ReviewCounts } from "@/lib/repos/review-counts";
import { Glyph } from "@/components/ui/Glyph";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-widest text-ink-faint px-2.5 pt-0.5 pb-1.5 md:group-data-[collapsed=true]/nav:hidden">
      {children}
    </p>
  );
}

function Row({ entry, counts }: { entry: NavEntry; counts?: ReviewCounts }) {
  return (
    <SideNavItem
      href={entry.href}
      label={entry.label}
      icon={entry.icon}
      shortcut={entry.shortcut}
      excludePaths={entry.excludePaths}
      badge={entry.count && counts ? counts[entry.count] : undefined}
    />
  );
}

export async function SideNav() {
  const user = await getSessionUser();
  const role = user?.role;
  const isAdmin = role === "admin";

  const main = mainNav(role);
  const review = reviewNav(role);
  const vendors = vendorsNav(role);
  const tabs = settingsTabs(role);
  // Only the Review rows that carry a badge need the counts, and only a
  // privileged role sees any of them — a member pays for no extra query.
  const counts = review.some((e) => e.count) ? await getReviewCounts() : undefined;

  const handleSignOut = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  return (
    /* A white rail against the grey page — the rail is the raised surface and
       the content area is the ground. */
    <nav
      className="h-full w-56 md:w-full shrink-0 border-r border-border bg-bg-raised flex flex-col overflow-hidden"
      aria-label="Primary"
    >
      {/* ── Logo row ──────────────────────────────────────────────────────────
          Expanded: [logo+wordmark] grows, toggle pinned right.
          Collapsed: logo centers; toggle hides (moves to its own row below). */}
      <div className="shrink-0 flex items-center gap-2.5 px-3 pt-3.5 pb-2.5 md:group-data-[collapsed=true]/nav:px-0 md:group-data-[collapsed=true]/nav:justify-center">
        <span
          className="shrink-0 inline-flex w-7 h-7 items-center justify-center rounded bg-accent text-bg-raised shadow-bevel"
          aria-hidden
        >
          <Glyph size={18} />
        </span>
        <div className="flex-1 min-w-0 md:group-data-[collapsed=true]/nav:hidden">
          <div className="font-display text-[15px] text-ink leading-none" style={{ fontWeight: 600 }}>
            Ledgerline
          </div>
          <div className="text-[10px] text-ink-faint leading-none mt-[3px] font-sans">
            billing &amp; revenue
          </div>
        </div>
        <div className="md:group-data-[collapsed=true]/nav:hidden">
          <SidebarCollapseToggle />
        </div>
      </div>

      {/* Collapsed-only toggle row (centered, below logo). */}
      <div className="hidden md:group-data-[collapsed=true]/nav:flex shrink-0 justify-center pb-1.5">
        <SidebarCollapseToggle />
      </div>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-2 pb-2 md:group-data-[collapsed=true]/nav:px-1.5">
        <SidebarSearchButton />
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 mx-3 border-t border-border md:group-data-[collapsed=true]/nav:mx-1.5" />

      {/* ── Nav sections — scrollable ─────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2.5 px-2 md:group-data-[collapsed=true]/nav:px-1.5 space-y-4">
        {/* Main — the books you read. */}
        <section aria-label="Main navigation">
          <SectionLabel>Main</SectionLabel>
          <ul className="space-y-1">
            {main.map((e) => (
              <Row key={e.href} entry={e} />
            ))}
          </ul>
        </section>

        {/* Review — the queues you work. Same section for admins and editors;
            each row is filtered by the role its route already guards on, so
            there's one tree instead of two. The badge is the point: open work
            is visible without expanding anything. */}
        {review.length > 0 && (
          <section aria-label="Review navigation">
            <SectionLabel>Review</SectionLabel>
            <ul className="space-y-1">
              {review.map((e) => (
                <Row key={e.href} entry={e} counts={counts} />
              ))}
            </ul>
          </section>
        )}

        {/* Vendors — the supply side. A section rather than a Settings tab
            because a vendor is an entity with pages of its own, and its rate
            card was never a setting. */}
        {vendors.length > 0 && (
          <section aria-label="Vendors navigation">
            <SectionLabel>Vendors</SectionLabel>
            <ul className="space-y-1">
              {vendors.map((e) => (
                <Row key={e.href} entry={e} />
              ))}
            </ul>
          </section>
        )}

        {/* Settings — one entry into a tabbed page. It stays lit on every tab,
            all of which keep their own routes. */}
        {isAdmin && tabs.length > 0 && (
          <section aria-label="Settings navigation">
            <ul className="space-y-1">
              <SideNavItem
                href={SETTINGS_ENTRY.href}
                label={SETTINGS_ENTRY.label}
                icon={SETTINGS_ENTRY.icon}
                activePaths={tabs.map((t) => t.href)}
              />
            </ul>
          </section>
        )}
      </div>

      {/* ── Help anchor (notifications now live top-right in the page header) ─ */}
      <div className="shrink-0 px-2 pb-1.5 md:group-data-[collapsed=true]/nav:px-1.5 space-y-1">
        <ul>
          <Row entry={HELP_ENTRY} />
        </ul>
      </div>

      {/* ── User profile ─────────────────────────────────────────────────── */}
      {user && (
        <div className="shrink-0 border-t border-border p-2 md:group-data-[collapsed=true]/nav:p-1.5">
          <UserProfileButton
            userId={user.id}
            name={user.name ?? ""}
            email={user.email ?? ""}
            role={user.role ?? "member"}
            emoji={user.emoji ?? null}
            jobTitle={user.job_title ?? null}
            isAdmin={isAdmin}
            signOutAction={handleSignOut}
          />
        </div>
      )}
    </nav>
  );
}
