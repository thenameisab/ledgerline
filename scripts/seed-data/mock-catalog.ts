// Fully fictional catalog for the Ledgerline portfolio mock. No real customers,
// vendors, or API codes. Everything downstream (pricing, usage, invoices) is
// generated from these definitions in scripts/seed-mock.ts.

export type MockAccount = { name: string };

export type MockClient = {
  display_name: string;
  account: string;
  billing_entity: string;
  gstin: string;
  status: "active" | "paused" | "sandbox";
  is_sandbox?: boolean;
  /** How many distinct APIs this client consumes (drives usage breadth). */
  apiCount: number;
  /** Relative traffic scale — multiplies daily hit volumes. */
  scale: number;
};

export type MockApi = {
  product_code: string;
  name: string;
  category: string;
  entity_type: "Individual" | "Business";
  vendor_type: "Direct" | "Aggregator";
  default_vendor: string;
  is_active: 0 | 1;
  /** Typical per-successful-hit price in ₹ — the magnitude band for this SKU. */
  priceBand: number;
};

export const MOCK_VENDORS = ["Quantal", "Verisys", "DataBridge", "NovaCheck", "Lumen ID", "Sentinel Data"] as const;

// Old spellings that the vendor registry merges into one vendor. Early usage
// rows carry the first spelling; /vendors shows one vendor.
export const MOCK_VENDOR_ALIASES: Record<string, string[]> = {
  Verisys: ["Veri-Sys", "Verisys Ltd"],
};

// A vendor we no longer route traffic to. It keeps its rate history and page.
export const MOCK_INACTIVE_VENDOR = "Sentinel Data";

export const MOCK_ACCOUNTS: MockAccount[] = [
  { name: "Northwind Financial" },
  { name: "Acme Lending" },
  { name: "Vertex Pay" },
  { name: "Helios Capital" },
  { name: "Orbit Neobank" },
  { name: "Zenith Holdings" },
  { name: "Ledgerline (internal)" },
];

export const MOCK_CLIENTS: MockClient[] = [
  // Northwind Financial group
  { display_name: "Northwind Finance Limited", account: "Northwind Financial", billing_entity: "Northwind Finance Limited", gstin: "27AABCN1234A1Z5", status: "active", apiCount: 12, scale: 1.6 },
  { display_name: "Northwind Home Loans", account: "Northwind Financial", billing_entity: "Northwind Housing Finance Pvt Ltd", gstin: "27AABCN1234A2Z4", status: "active", apiCount: 8, scale: 0.9 },
  { display_name: "Northwind Insurance Brokers", account: "Northwind Financial", billing_entity: "Northwind Insurance Brokers LLP", gstin: "27AABCN1234A3Z3", status: "active", apiCount: 6, scale: 0.5 },
  // Acme Lending group
  { display_name: "Acme Lending Co", account: "Acme Lending", billing_entity: "Acme Lending Private Limited", gstin: "29AACCA5678B1Z2", status: "active", apiCount: 10, scale: 1.3 },
  { display_name: "Acme Microfinance", account: "Acme Lending", billing_entity: "Acme Microfinance Pvt Ltd", gstin: "29AACCA5678B2Z1", status: "active", apiCount: 7, scale: 0.7 },
  // Vertex Pay group
  { display_name: "Vertex Pay", account: "Vertex Pay", billing_entity: "Vertex Payments India Pvt Ltd", gstin: "06AAECV9012C1Z9", status: "active", apiCount: 11, scale: 1.5 },
  { display_name: "Vertex Merchant Services", account: "Vertex Pay", billing_entity: "Vertex Merchant Services Pvt Ltd", gstin: "06AAECV9012C2Z8", status: "active", apiCount: 6, scale: 0.6 },
  // Helios Capital group
  { display_name: "Helios Capital", account: "Helios Capital", billing_entity: "Helios Capital Advisors Pvt Ltd", gstin: "19AAFCH3456D1Z7", status: "active", apiCount: 9, scale: 1.1 },
  { display_name: "Helios Wealth", account: "Helios Capital", billing_entity: "Helios Wealth Management Pvt Ltd", gstin: "19AAFCH3456D2Z6", status: "paused", apiCount: 5, scale: 0.3 },
  // Orbit Neobank group
  { display_name: "Orbit Neobank", account: "Orbit Neobank", billing_entity: "Orbit Digital Bank Pvt Ltd", gstin: "33AAGCO7890E1Z4", status: "active", apiCount: 13, scale: 1.8 },
  { display_name: "Orbit Cards", account: "Orbit Neobank", billing_entity: "Orbit Cards Pvt Ltd", gstin: "33AAGCO7890E2Z3", status: "active", apiCount: 7, scale: 0.8 },
  { display_name: "Orbit SME", account: "Orbit Neobank", billing_entity: "Orbit SME Lending Pvt Ltd", gstin: "33AAGCO7890E3Z2", status: "active", apiCount: 6, scale: 0.5 },
  // Zenith Holdings group: signed, not live yet, so the group shows ₹0 revenue.
  { display_name: "Zenith Payments", account: "Zenith Holdings", billing_entity: "Zenith Payments Pvt Ltd", gstin: "24AAJCZ4321H1Z5", status: "active", apiCount: 0, scale: 0.1 },
  // Independent
  { display_name: "Summit Credit Union", account: "Helios Capital", billing_entity: "Summit Credit Co-operative Ltd", gstin: "08AAHCS2345F1Z0", status: "active", apiCount: 5, scale: 0.4 },
  { display_name: "Pinnacle NBFC", account: "Acme Lending", billing_entity: "Pinnacle Finserv Pvt Ltd", gstin: "29AAICP6789G1Z8", status: "active", apiCount: 8, scale: 0.9 },
  // Sandbox / internal
  { display_name: "Ledgerline Sandbox", account: "Ledgerline (internal)", billing_entity: "Ledgerline Internal", gstin: "27AAACF0000Z1Z0", status: "sandbox", is_sandbox: true, apiCount: 4, scale: 0.2 },
  { display_name: "Acme Lending (Sandbox)", account: "Ledgerline (internal)", billing_entity: "Acme Lending Private Limited", gstin: "29AACCA5678B9Z9", status: "sandbox", is_sandbox: true, apiCount: 3, scale: 0.15 },
];

// Catalog — fictional codes, grouped by category. priceBand is the typical
// per-hit ₹ rate; per-client negotiated rates vary around it in the seed.
export const MOCK_APIS: MockApi[] = [
  // KYC / Identity
  { product_code: "KY1001", name: "PAN Verification", category: "KYC", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "Quantal", is_active: 1, priceBand: 1.5 },
  { product_code: "KY1002", name: "Aadhaar OTP Verification", category: "KYC", entity_type: "Individual", vendor_type: "Direct", default_vendor: "Verisys", is_active: 1, priceBand: 3.0 },
  { product_code: "KY1003", name: "Aadhaar Offline XML", category: "KYC", entity_type: "Individual", vendor_type: "Direct", default_vendor: "Verisys", is_active: 1, priceBand: 2.5 },
  { product_code: "KY1004", name: "Voter ID Verification", category: "KYC", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "Quantal", is_active: 1, priceBand: 2.0 },
  { product_code: "KY1005", name: "Passport Verification", category: "KYC", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "DataBridge", is_active: 1, priceBand: 4.0 },
  { product_code: "KY1006", name: "Driving License Verification", category: "KYC", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "Quantal", is_active: 1, priceBand: 2.2 },
  { product_code: "KY1007", name: "Face Match", category: "KYC", entity_type: "Individual", vendor_type: "Direct", default_vendor: "NovaCheck", is_active: 1, priceBand: 3.5 },
  { product_code: "KY1008", name: "Liveness Detection", category: "KYC", entity_type: "Individual", vendor_type: "Direct", default_vendor: "NovaCheck", is_active: 1, priceBand: 4.5 },
  { product_code: "KY1009", name: "Aadhaar Paperless eKYC (legacy)", category: "KYC", entity_type: "Individual", vendor_type: "Direct", default_vendor: "Verisys", is_active: 0, priceBand: 2.0 },
  // Business / KYB
  { product_code: "KB2001", name: "GSTIN Verification", category: "Business", entity_type: "Business", vendor_type: "Aggregator", default_vendor: "DataBridge", is_active: 1, priceBand: 2.0 },
  { product_code: "KB2002", name: "Company CIN Lookup", category: "Business", entity_type: "Business", vendor_type: "Aggregator", default_vendor: "DataBridge", is_active: 1, priceBand: 3.0 },
  { product_code: "KB2003", name: "Director Identification (DIN)", category: "Business", entity_type: "Business", vendor_type: "Aggregator", default_vendor: "DataBridge", is_active: 1, priceBand: 3.5 },
  { product_code: "KB2004", name: "Udyam / MSME Verification", category: "Business", entity_type: "Business", vendor_type: "Aggregator", default_vendor: "Quantal", is_active: 1, priceBand: 2.5 },
  { product_code: "KB2005", name: "Shop & Establishment Check", category: "Business", entity_type: "Business", vendor_type: "Aggregator", default_vendor: "DataBridge", is_active: 1, priceBand: 4.0 },
  // Bank
  { product_code: "BV3001", name: "Bank Account Verification (Penny Drop)", category: "Bank", entity_type: "Individual", vendor_type: "Direct", default_vendor: "Verisys", is_active: 1, priceBand: 2.8 },
  { product_code: "BV3002", name: "Bank Account Verification (Pennyless)", category: "Bank", entity_type: "Individual", vendor_type: "Direct", default_vendor: "Verisys", is_active: 1, priceBand: 3.2 },
  { product_code: "BV3003", name: "UPI ID Verification", category: "Bank", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "Quantal", is_active: 1, priceBand: 1.2 },
  { product_code: "BV3004", name: "IFSC Lookup", category: "Bank", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "Quantal", is_active: 1, priceBand: 0.5 },
  // Income / Financial
  { product_code: "IN4001", name: "ITR Verification", category: "Income", entity_type: "Individual", vendor_type: "Direct", default_vendor: "DataBridge", is_active: 1, priceBand: 5.0 },
  { product_code: "IN4002", name: "Form 26AS Pull", category: "Income", entity_type: "Individual", vendor_type: "Direct", default_vendor: "DataBridge", is_active: 1, priceBand: 6.0 },
  { product_code: "IN4003", name: "EPFO / UAN Lookup", category: "Income", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "Quantal", is_active: 1, priceBand: 3.5 },
  { product_code: "IN4004", name: "Bank Statement Analysis", category: "Income", entity_type: "Individual", vendor_type: "Direct", default_vendor: "NovaCheck", is_active: 1, priceBand: 8.0 },
  { product_code: "IN4005", name: "Salary Slip OCR", category: "Income", entity_type: "Individual", vendor_type: "Direct", default_vendor: "NovaCheck", is_active: 1, priceBand: 4.0 },
  // Fraud / Risk
  { product_code: "FR5001", name: "Credit Bureau Pull", category: "Fraud", entity_type: "Individual", vendor_type: "Direct", default_vendor: "DataBridge", is_active: 1, priceBand: 12.0 },
  { product_code: "FR5002", name: "Mobile Risk Score", category: "Fraud", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "Quantal", is_active: 1, priceBand: 2.5 },
  { product_code: "FR5003", name: "Email Risk Score", category: "Fraud", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "Quantal", is_active: 1, priceBand: 2.0 },
  { product_code: "FR5004", name: "Device Fingerprint", category: "Fraud", entity_type: "Individual", vendor_type: "Direct", default_vendor: "NovaCheck", is_active: 1, priceBand: 3.0 },
  { product_code: "FR5005", name: "AML / PEP Screening", category: "Fraud", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "DataBridge", is_active: 1, priceBand: 6.5 },
  { product_code: "FR5006", name: "Negative List Check", category: "Fraud", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "DataBridge", is_active: 1, priceBand: 1.8 },
  // Address / Other
  { product_code: "AD6001", name: "Address Geocoding", category: "Address", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "Lumen ID", is_active: 1, priceBand: 1.0 },
  { product_code: "AD6002", name: "Digital Address Verification", category: "Address", entity_type: "Individual", vendor_type: "Direct", default_vendor: "Lumen ID", is_active: 1, priceBand: 3.8 },
  { product_code: "AD6003", name: "Pincode Serviceability (legacy)", category: "Address", entity_type: "Individual", vendor_type: "Aggregator", default_vendor: "Quantal", is_active: 0, priceBand: 0.4 },
];

export type MockUser = {
  email: string;
  display_name: string;
  role: "admin" | "editor" | "member";
  status: "active" | "invited" | "disabled";
  emoji: string;
  job_title: string;
  /** Invited users only: the invite already lapsed (expired-invite state). */
  inviteExpired?: boolean;
};

export const MOCK_USERS: MockUser[] = [
  { email: "admin@ledgerline.local", display_name: "Maya Sharma", role: "admin", status: "active", emoji: "🦊", job_title: "Head of Finance" },
  { email: "analyst@ledgerline.local", display_name: "Rohan Mehta", role: "member", status: "active", emoji: "🦉", job_title: "Revenue Analyst" },
  { email: "ops@ledgerline.local", display_name: "Priya Nair", role: "member", status: "active", emoji: "🐬", job_title: "Billing Operations" },
  { email: "editor@ledgerline.local", display_name: "Dev Kapoor", role: "editor", status: "active", emoji: "🐙", job_title: "Billing Editor" },
  { email: "newjoiner@ledgerline.local", display_name: "Arjun Rao", role: "member", status: "invited", emoji: "🦝", job_title: "Finance Associate" },
  { email: "contractor@ledgerline.local", display_name: "Leela Bose", role: "member", status: "invited", emoji: "🦜", job_title: "Audit Contractor", inviteExpired: true },
  { email: "former@ledgerline.local", display_name: "Sara Khan", role: "member", status: "disabled", emoji: "🐢", job_title: "Analyst (alumni)" },
];
