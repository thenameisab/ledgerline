import type { GuideModule } from "../types";

import * as signInToLedgerline from "./sign-in-to-ledgerline";
import * as commandPalette from "./command-palette";
import * as readTheDashboard from "./read-the-dashboard";
import * as filterByDateRange from "./filter-by-date-range";
import * as investigateAAccount from "./investigate-an-account";
import * as editAAccountProfile from "./edit-an-account-profile";
import * as investigateAnApi from "./investigate-a-sku";
import * as askThePalette from "./ask-the-palette";
import * as setAccountPricing from "./set-account-pricing";
import * as createAStitchedBundle from "./create-a-stitched-bundle";
import * as setSlabPricing from "./set-slab-pricing";
import * as fixUnpricedTraffic from "./fix-unpriced-traffic";
import * as finalizeAnInvoice from "./finalize-an-invoice";
import * as addAnInvoiceAdjustment from "./add-an-invoice-adjustment";
import * as downloadInvoiceDocuments from "./download-invoice-documents";
import * as manageSandboxTraffic from "./manage-sandbox-traffic";
import * as refreshUsageData from "./refresh-usage-data";
import * as backfillUsageData from "./backfill-usage-data";
import * as resolveUnmappedNames from "./resolve-unmapped-names";
import * as logAManualEntry from "./log-a-manual-entry";
import * as inviteAUser from "./invite-a-user";
import * as manageRolesAndAccess from "./manage-roles-and-access";
import * as editYourProfile from "./edit-your-profile";
import * as manageVendorCosts from "./manage-vendor-costs";
import * as readTheAuditLog from "./read-the-audit-log";
import * as createOrEditAnApi from "./create-or-edit-a-sku";

/**
 * How-to guide registry. Each guide is a module in this folder exporting
 * `meta` (GuideMeta) and a default Body component built from the doc
 * primitives in @/components/help/doc. Order here is display order.
 */
export const guides: GuideModule[] = [
  // Getting started
  { meta: signInToLedgerline.meta, Body: signInToLedgerline.default },
  { meta: commandPalette.meta, Body: commandPalette.default },
  { meta: readTheDashboard.meta, Body: readTheDashboard.default },
  // Daily work
  { meta: filterByDateRange.meta, Body: filterByDateRange.default },
  { meta: investigateAAccount.meta, Body: investigateAAccount.default },
  { meta: editAAccountProfile.meta, Body: editAAccountProfile.default },
  { meta: investigateAnApi.meta, Body: investigateAnApi.default },
  { meta: askThePalette.meta, Body: askThePalette.default },
  // Pricing
  { meta: setAccountPricing.meta, Body: setAccountPricing.default },
  { meta: createAStitchedBundle.meta, Body: createAStitchedBundle.default },
  { meta: setSlabPricing.meta, Body: setSlabPricing.default },
  { meta: fixUnpricedTraffic.meta, Body: fixUnpricedTraffic.default },
  // Billing
  { meta: finalizeAnInvoice.meta, Body: finalizeAnInvoice.default },
  { meta: addAnInvoiceAdjustment.meta, Body: addAnInvoiceAdjustment.default },
  { meta: downloadInvoiceDocuments.meta, Body: downloadInvoiceDocuments.default },
  // Sandbox
  { meta: manageSandboxTraffic.meta, Body: manageSandboxTraffic.default },
  // Data pipeline
  { meta: refreshUsageData.meta, Body: refreshUsageData.default },
  { meta: backfillUsageData.meta, Body: backfillUsageData.default },
  { meta: resolveUnmappedNames.meta, Body: resolveUnmappedNames.default },
  { meta: logAManualEntry.meta, Body: logAManualEntry.default },
  // Team & access
  { meta: inviteAUser.meta, Body: inviteAUser.default },
  { meta: manageRolesAndAccess.meta, Body: manageRolesAndAccess.default },
  { meta: editYourProfile.meta, Body: editYourProfile.default },
  // Admin
  { meta: manageVendorCosts.meta, Body: manageVendorCosts.default },
  { meta: readTheAuditLog.meta, Body: readTheAuditLog.default },
  { meta: createOrEditAnApi.meta, Body: createOrEditAnApi.default },
];
