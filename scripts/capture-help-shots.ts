/**
 * Captures product screenshots for the /help docs into public/help/shots/.
 *
 * Run against a dev server started with AUTH_BYPASS=true:
 *   BASE_URL=http://localhost:3001 npx tsx scripts/capture-help-shots.ts
 *
 * Dynamic routes (account slug, API code, vendor, invoice period) are
 * discovered by reading links off the rendered list pages, so the script
 * works on any seeded database.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const OUT = path.join(process.cwd(), "public", "help", "shots");

async function settle(page: Page, ms = 900) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

async function shot(page: Page, route: string, name: string, opts: { fullPage?: boolean } = {}) {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.fullPage ?? false });
  console.log(`✓ ${name}  (${route})`);
}

async function firstHref(page: Page, route: string, selector: string): Promise<string | null> {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await settle(page);
  const href = await page.locator(selector).first().getAttribute("href").catch(() => null);
  return href;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    timezoneId: "Asia/Kolkata",
  });
  const page = await ctx.newPage();

  // ── Discover dynamic routes ──────────────────────────────────────────
  // Exclude the Group Management route (/accounts/groups) so we land on a
  // real account row, not the groups list.
  const accountHref = await firstHref(
    page,
    "/accounts",
    'a[href^="/accounts/"]:not([href^="/accounts/groups"])'
  );
  const apiHref = await firstHref(page, "/skus", 'a[href^="/skus/"]');
  const vendorHref = await firstHref(page, "/vendors", 'a[href^="/vendors/"]:not([href="/vendors/reconciliation"])');
  console.log({ accountHref, apiHref, vendorHref });

  // ── Core surfaces ────────────────────────────────────────────────────
  await shot(page, "/dashboard", "dashboard");
  await shot(page, "/dashboard", "dashboard-full", { fullPage: true });
  await shot(page, "/accounts", "accounts");
  await shot(page, "/skus", "apis");
  await shot(page, "/login", "login");

  if (accountHref) {
    await shot(page, accountHref, "account-detail");
    await shot(page, accountHref, "account-detail-full", { fullPage: true });
    await shot(page, `${accountHref}/pricing`, "account-pricing", { fullPage: true });
    await shot(page, `${accountHref}/profile`, "account-profile-edit", { fullPage: true });
    await shot(page, `${accountHref}/invoices`, "account-invoices");
    await shot(page, `${accountHref}/manual-entry/new`, "manual-entry-wizard", { fullPage: true });

    const periodHref = await firstHref(page, `${accountHref}/invoices`, `a[href^="${accountHref}/invoices/"]`);
    if (periodHref) await shot(page, periodHref, "invoice-detail", { fullPage: true });
  }

  if (apiHref) {
    await shot(page, apiHref, "api-detail", { fullPage: true });
  }

  // ── Admin surfaces ───────────────────────────────────────────────────
  await shot(page, "/vendors", "admin-vendor-cost");
  if (vendorHref) await shot(page, vendorHref, "admin-vendor-detail", { fullPage: true });
  await shot(page, "/admin/aliases", "admin-aliases");
  await shot(page, "/admin/manual-entries", "admin-manual-entries");
  await shot(page, "/admin/users", "admin-users");
  await shot(page, "/admin/sync", "admin-sync");
  await shot(page, "/admin/settings", "admin-settings");
  await shot(page, "/admin/audit", "admin-audit");
  await shot(page, "/admin/sku-review", "admin-api-review", { fullPage: true });

  // ── Slab (tiered) pricing modal ──────────────────────────────────────
  // Opens the SlabModal off a flat pricing row's "tier" toggle. Read-only:
  // opening the editor saves nothing. Skips cleanly if the account has no
  // flat row to tier.
  if (accountHref) {
    try {
      await page.goto(BASE + `${accountHref}/pricing`, { waitUntil: "domcontentloaded" });
      await settle(page);
      const tierBtn = page.locator('button[title="Switch to graduated, volume-tiered pricing"]').first();
      if (await tierBtn.count()) {
        await tierBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(OUT, "account-pricing-slab.png") });
        console.log("✓ account-pricing-slab");
      } else {
        console.log("· account-pricing-slab skipped (no flat row to tier)");
      }
    } catch (e) {
      console.log("· account-pricing-slab skipped:", (e as Error).message);
    }
  }

  // ── Profile modal ────────────────────────────────────────────────────
  // Open the sidebar profile menu, then the Profile item. Read-only.
  try {
    await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.locator('button[aria-haspopup="menu"]').first().click();
    await page.waitForTimeout(250);
    await page.getByText("Profile", { exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "profile-edit.png") });
    console.log("✓ profile-edit");
  } catch (e) {
    console.log("· profile-edit skipped:", (e as Error).message);
  }

  // ── Command palette (⌘K) — v2 search results, then ask-mode answer ───
  // Type a real account token (derived from the discovered slug) so the
  // search shot shows the grouped, metadata-rich rows.
  const term = accountHref?.split("/").pop()?.split("-")[0] || "a";
  await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(400);
  await page.keyboard.type(term, { delay: 40 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "command-palette.png") });
  console.log("✓ command-palette");

  // Ask mode: Escape clears the query (Meta+k won't close while the input is
  // focused), reopen empty, then ask a question that always returns rows.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(300);
  await page.keyboard.type("top 5 accounts", { delay: 30 });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: path.join(OUT, "command-palette-ask.png") });
  console.log("✓ command-palette-ask");

  await browser.close();
  console.log(`\nDone → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
