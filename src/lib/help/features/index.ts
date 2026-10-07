import type { FeatureModule } from "../types";

import * as revenueDashboard from "./revenue-dashboard";
import * as moneyAtRisk from "./money-at-risk";
import * as biggestMovers from "./biggest-movers";
import * as dashboardCharts from "./dashboard-charts";
import * as portfolioVisuals from "./portfolio-visuals";
import * as briefingPanel from "./briefing-panel";
import * as accountsDirectory from "./accounts-directory";
import * as accountProfile from "./account-profile";
import * as invoices from "./invoices";
import * as invoiceAdjustments from "./invoice-adjustments";
import * as invoiceExports from "./invoice-exports";
import * as manualEntries from "./manual-entries";
import * as accountPricing from "./account-pricing";
import * as adminPricing from "./admin-pricing";
import * as stitchedBundles from "./stitched-bundles";
import * as slabPricing from "./slab-pricing";
import * as unpricedTraffic from "./unpriced-traffic";
import * as sandboxControls from "./sandbox-controls";
import * as apiCatalog from "./api-catalog";
import * as apiProfile from "./api-profile";
import * as apiGovernance from "./api-governance";
import * as vendorCosts from "./vendor-costs";
import * as vendorReconciliation from "./vendor-reconciliation";
import * as aliases from "./aliases";
import * as usageSync from "./usage-sync";
import * as userManagement from "./user-management";
import * as auditLog from "./audit-log";
import * as settings from "./settings";
import * as commandPalette from "./command-palette";
import * as hoverCards from "./hover-cards";
import * as searchableDropdowns from "./searchable-dropdowns";
import * as navigation from "./navigation";
import * as authentication from "./authentication";

/**
 * Feature docs registry. Each feature is a module in this folder exporting
 * `meta` (FeatureMeta) and a default Body component built from the doc
 * primitives in @/components/help/doc. Order here is display order.
 */
export const features: FeatureModule[] = [
  // Dashboard
  { meta: revenueDashboard.meta, Body: revenueDashboard.default },
  { meta: moneyAtRisk.meta, Body: moneyAtRisk.default },
  { meta: biggestMovers.meta, Body: biggestMovers.default },
  { meta: dashboardCharts.meta, Body: dashboardCharts.default },
  { meta: portfolioVisuals.meta, Body: portfolioVisuals.default },
  { meta: briefingPanel.meta, Body: briefingPanel.default },
  // Accounts
  { meta: accountsDirectory.meta, Body: accountsDirectory.default },
  { meta: accountProfile.meta, Body: accountProfile.default },
  // Billing
  { meta: invoices.meta, Body: invoices.default },
  { meta: invoiceAdjustments.meta, Body: invoiceAdjustments.default },
  { meta: invoiceExports.meta, Body: invoiceExports.default },
  { meta: manualEntries.meta, Body: manualEntries.default },
  // Pricing
  { meta: accountPricing.meta, Body: accountPricing.default },
  { meta: adminPricing.meta, Body: adminPricing.default },
  { meta: stitchedBundles.meta, Body: stitchedBundles.default },
  { meta: slabPricing.meta, Body: slabPricing.default },
  { meta: unpricedTraffic.meta, Body: unpricedTraffic.default },
  // Sandbox
  { meta: sandboxControls.meta, Body: sandboxControls.default },
  // APIs
  { meta: apiCatalog.meta, Body: apiCatalog.default },
  { meta: apiProfile.meta, Body: apiProfile.default },
  { meta: apiGovernance.meta, Body: apiGovernance.default },
  // Admin
  { meta: vendorCosts.meta, Body: vendorCosts.default },
  { meta: vendorReconciliation.meta, Body: vendorReconciliation.default },
  { meta: aliases.meta, Body: aliases.default },
  { meta: usageSync.meta, Body: usageSync.default },
  { meta: userManagement.meta, Body: userManagement.default },
  { meta: auditLog.meta, Body: auditLog.default },
  { meta: settings.meta, Body: settings.default },
  // Platform
  { meta: commandPalette.meta, Body: commandPalette.default },
  { meta: hoverCards.meta, Body: hoverCards.default },
  { meta: searchableDropdowns.meta, Body: searchableDropdowns.default },
  { meta: navigation.meta, Body: navigation.default },
  { meta: authentication.meta, Body: authentication.default },
];
