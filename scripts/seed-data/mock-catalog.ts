// Fully fictional catalog for the Ledgerline portfolio mock. No real customers,
// vendors, or SKU codes. Everything downstream (pricing, usage, invoices) is
// generated from these definitions in scripts/seed-mock.ts.

export type MockAccount = { name: string };

export type MockClient = {
  display_name: string;
  account: string;
  billing_entity: string;
  /** Tax registration number shown on invoices (EIN, VAT or GST number). */
  tax_id: string;
  status: "active" | "paused" | "sandbox";
  is_sandbox?: boolean;
  /** Product lines this customer buys from. SKUs are picked from these lines. */
  lines: string[];
  /** How many distinct SKUs this customer consumes (drives usage breadth). */
  skuCount: number;
  /** Relative traffic scale — multiplies daily unit volumes. */
  scale: number;
};

export type MockApi = {
  product_code: string;
  name: string;
  /** Product line. */
  category: string;
  /** What one billed unit is: "1M tokens", "minute", "message", … */
  unit: string;
  vendor_type: "Direct" | "Aggregator";
  default_vendor: string;
  is_active: 0 | 1;
  /** List price per unit in USD. Negotiated rates vary around it in the seed. */
  priceBand: number;
  /** Typical units per day for a customer at scale 1. */
  daily: number;
};

// Upstream suppliers whose costs make up the margin.
export const MOCK_VENDORS = [
  "Cumulus Cloud",
  "Tessel Labs",
  "Northbeam Telecom",
  "Relay Messaging",
  "Mapline",
  "Ferro Compute",
] as const;

// Old spellings that the vendor registry merges into one vendor. Early usage
// rows carry the first spelling; /vendors shows one vendor.
export const MOCK_VENDOR_ALIASES: Record<string, string[]> = {
  "Cumulus Cloud": ["Cumulus GPU Cloud", "Cumulus Cloud Inc"],
};

// A vendor we no longer route traffic to. It keeps its rate history and page.
export const MOCK_INACTIVE_VENDOR = "Ferro Compute";

// The vendor that does not charge for sandbox traffic.
export const MOCK_FREE_SANDBOX_VENDOR = "Tessel Labs";

export const MOCK_ACCOUNTS: MockAccount[] = [
  { name: "Copperleaf Software" },
  { name: "Kestrel Commerce" },
  { name: "Harbor Logistics" },
  { name: "Brightline Health" },
  { name: "Quillmark Media" },
  { name: "Zenith Robotics" },
  { name: "Internal" },
];

const ALL_LINES = ["Models", "Agents", "Media", "Voice", "Messaging", "Data", "Compute"];

export const MOCK_CLIENTS: MockClient[] = [
  // Copperleaf Software group: a B2B SaaS company with AI features in its CRM and helpdesk.
  { display_name: "Copperleaf CRM", account: "Copperleaf Software", billing_entity: "Copperleaf Software Inc.", tax_id: "EIN 84-2917365", status: "active", lines: ["Models", "Agents", "Data", "Messaging"], skuCount: 12, scale: 1.6 },
  { display_name: "Copperleaf Support", account: "Copperleaf Software", billing_entity: "Copperleaf Support LLC", tax_id: "EIN 84-2917402", status: "active", lines: ["Voice", "Models", "Messaging"], skuCount: 8, scale: 0.9 },
  { display_name: "Copperleaf Labs", account: "Copperleaf Software", billing_entity: "Copperleaf Labs LLC", tax_id: "EIN 84-2917488", status: "active", lines: ["Compute", "Models"], skuCount: 6, scale: 0.5 },
  // Kestrel Commerce group: online retail.
  { display_name: "Kestrel Store", account: "Kestrel Commerce", billing_entity: "Kestrel Commerce Ltd", tax_id: "VAT GB 293 4821 07", status: "active", lines: ["Models", "Data", "Media", "Messaging"], skuCount: 10, scale: 1.3 },
  { display_name: "Kestrel Ads", account: "Kestrel Commerce", billing_entity: "Kestrel Media Ltd", tax_id: "VAT GB 293 4821 52", status: "active", lines: ["Media", "Models"], skuCount: 7, scale: 0.7 },
  // Harbor Logistics group: freight and delivery.
  { display_name: "Harbor Freight", account: "Harbor Logistics", billing_entity: "Harbor Logistics GmbH", tax_id: "VAT DE 318 552 904", status: "active", lines: ["Data", "Messaging", "Voice", "Agents"], skuCount: 11, scale: 1.5 },
  { display_name: "Harbor Last Mile", account: "Harbor Logistics", billing_entity: "Harbor Last Mile GmbH", tax_id: "VAT DE 318 552 961", status: "active", lines: ["Messaging", "Data"], skuCount: 6, scale: 0.6 },
  // Brightline Health group: clinics and telehealth.
  { display_name: "Brightline Clinics", account: "Brightline Health", billing_entity: "Brightline Health Inc.", tax_id: "EIN 47-1038829", status: "active", lines: ["Voice", "Models", "Data"], skuCount: 9, scale: 1.1 },
  { display_name: "Brightline Pharmacy", account: "Brightline Health", billing_entity: "Brightline Pharmacy Inc.", tax_id: "EIN 47-1038871", status: "paused", lines: ["Messaging"], skuCount: 5, scale: 0.3 },
  // Quillmark Media group: video, news and podcasts.
  { display_name: "Quillmark Studio", account: "Quillmark Media", billing_entity: "Quillmark Media Inc.", tax_id: "EIN 61-2290417", status: "active", lines: ["Media", "Voice", "Models", "Compute"], skuCount: 13, scale: 1.8 },
  { display_name: "Quillmark News", account: "Quillmark Media", billing_entity: "Quillmark News Inc.", tax_id: "EIN 61-2290453", status: "active", lines: ["Models", "Agents", "Data"], skuCount: 7, scale: 0.8 },
  { display_name: "Quillmark Podcasts", account: "Quillmark Media", billing_entity: "Quillmark Audio LLC", tax_id: "EIN 61-2290489", status: "active", lines: ["Voice", "Media"], skuCount: 6, scale: 0.5 },
  // Zenith Robotics group: signed, not live yet, so the group shows $0 revenue.
  { display_name: "Zenith Robotics", account: "Zenith Robotics", billing_entity: "Zenith Robotics Pte Ltd", tax_id: "UEN 202318845K", status: "active", lines: ALL_LINES, skuCount: 0, scale: 0.1 },
  { display_name: "Summit Telehealth", account: "Brightline Health", billing_entity: "Summit Telehealth Inc.", tax_id: "EIN 47-3310592", status: "active", lines: ["Voice", "Models"], skuCount: 5, scale: 0.4 },
  { display_name: "Pinnacle Markets", account: "Kestrel Commerce", billing_entity: "Pinnacle Markets Pvt Ltd", tax_id: "GST 29AAICP6789G1Z8", status: "active", lines: ["Models", "Data", "Messaging"], skuCount: 8, scale: 0.9 },
  // Sandbox / internal
  { display_name: "Internal QA", account: "Internal", billing_entity: "Internal", tax_id: "", status: "sandbox", is_sandbox: true, lines: ["Models", "Voice"], skuCount: 4, scale: 0.2 },
  { display_name: "Kestrel Store (Sandbox)", account: "Internal", billing_entity: "Kestrel Commerce Ltd", tax_id: "VAT GB 293 4821 07", status: "sandbox", is_sandbox: true, lines: ["Models", "Data"], skuCount: 3, scale: 0.15 },
];

// Catalog — fictional SKUs, grouped by product line. Model SKUs are priced per
// 1M tokens; other SKUs per call, minute, message, image, second or hour.
export const MOCK_APIS: MockApi[] = [
  // Models: the Atlas text models, one SKU per model and token type.
  { product_code: "ATL-PRO-IN", name: "Atlas Pro · input tokens", category: "Models", unit: "1M tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 3.0, daily: 420 },
  { product_code: "ATL-PRO-OUT", name: "Atlas Pro · output tokens", category: "Models", unit: "1M tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 15.0, daily: 85 },
  { product_code: "ATL-PRO-CACHE", name: "Atlas Pro · cached input tokens", category: "Models", unit: "1M tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.3, daily: 1600 },
  { product_code: "ATL-FLASH-IN", name: "Atlas Flash · input tokens", category: "Models", unit: "1M tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.15, daily: 5200 },
  { product_code: "ATL-FLASH-OUT", name: "Atlas Flash · output tokens", category: "Models", unit: "1M tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.6, daily: 1300 },
  { product_code: "ATL-REASON-IN", name: "Atlas Reason · input tokens", category: "Models", unit: "1M tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 2.0, daily: 260 },
  { product_code: "ATL-REASON-OUT", name: "Atlas Reason · reasoning + output tokens", category: "Models", unit: "1M tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 8.0, daily: 140 },
  { product_code: "ATL-BATCH-IN", name: "Atlas Pro Batch · input tokens", category: "Models", unit: "1M tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 1.5, daily: 700 },
  { product_code: "ATL-EMBED", name: "Atlas Embed v3", category: "Models", unit: "1M tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.02, daily: 9000 },
  { product_code: "ATL-RERANK", name: "Atlas Rerank", category: "Models", unit: "1K searches", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 2.0, daily: 110 },
  { product_code: "ATL-2-IN", name: "Atlas 2 · input tokens (legacy)", category: "Models", unit: "1M tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 0, priceBand: 1.0, daily: 300 },
  // Agents: tools that models call while they work.
  { product_code: "AGT-SEARCH", name: "Web search tool", category: "Agents", unit: "1K calls", vendor_type: "Aggregator", default_vendor: "Tessel Labs", is_active: 1, priceBand: 10.0, daily: 28 },
  { product_code: "AGT-SANDBOX", name: "Code sandbox", category: "Agents", unit: "session-hour", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.05, daily: 3600 },
  { product_code: "AGT-BROWSER", name: "Browser agent", category: "Agents", unit: "browser-minute", vendor_type: "Aggregator", default_vendor: "Tessel Labs", is_active: 1, priceBand: 0.02, daily: 9500 },
  { product_code: "AGT-MCP", name: "Hosted MCP tool calls", category: "Agents", unit: "1K calls", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 1.0, daily: 160 },
  // Media: image and video generation.
  { product_code: "PRM-IMG-STD", name: "Prism Image · standard", category: "Media", unit: "image", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.04, daily: 4200 },
  { product_code: "PRM-IMG-HD", name: "Prism Image · HD", category: "Media", unit: "image", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.08, daily: 1700 },
  { product_code: "PRM-IMG-EDIT", name: "Prism Image · edit", category: "Media", unit: "image", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.03, daily: 2600 },
  { product_code: "PRM-VID-720", name: "Prism Video · 720p", category: "Media", unit: "second", vendor_type: "Aggregator", default_vendor: "Tessel Labs", is_active: 1, priceBand: 0.1, daily: 1500 },
  { product_code: "PRM-VID-1080", name: "Prism Video · 1080p", category: "Media", unit: "second", vendor_type: "Aggregator", default_vendor: "Tessel Labs", is_active: 1, priceBand: 0.25, daily: 520 },
  // Voice: speech in and out.
  { product_code: "VOX-STT-RT", name: "Speech-to-text · realtime", category: "Voice", unit: "minute", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.006, daily: 26000 },
  { product_code: "VOX-STT-BATCH", name: "Speech-to-text · batch", category: "Voice", unit: "minute", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.003, daily: 40000 },
  { product_code: "VOX-TTS", name: "Text-to-speech", category: "Voice", unit: "1K characters", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.015, daily: 9000 },
  { product_code: "VOX-AGENT", name: "Realtime voice agent", category: "Voice", unit: "minute", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.06, daily: 3200 },
  { product_code: "VOX-CLONE", name: "Voice cloning", category: "Voice", unit: "voice", vendor_type: "Aggregator", default_vendor: "Tessel Labs", is_active: 1, priceBand: 1.5, daily: 40 },
  // Messaging: SMS, WhatsApp, email and calls.
  { product_code: "MSG-SMS-US", name: "SMS · United States", category: "Messaging", unit: "message", vendor_type: "Aggregator", default_vendor: "Northbeam Telecom", is_active: 1, priceBand: 0.0079, daily: 19000 },
  { product_code: "MSG-SMS-UK", name: "SMS · United Kingdom", category: "Messaging", unit: "message", vendor_type: "Aggregator", default_vendor: "Northbeam Telecom", is_active: 1, priceBand: 0.04, daily: 3600 },
  { product_code: "MSG-SMS-IN", name: "SMS · India", category: "Messaging", unit: "message", vendor_type: "Aggregator", default_vendor: "Northbeam Telecom", is_active: 1, priceBand: 0.0035, daily: 30000 },
  { product_code: "MSG-WA-UTIL", name: "WhatsApp · utility template", category: "Messaging", unit: "message", vendor_type: "Aggregator", default_vendor: "Relay Messaging", is_active: 1, priceBand: 0.0085, daily: 16000 },
  { product_code: "MSG-WA-MKT", name: "WhatsApp · marketing template", category: "Messaging", unit: "message", vendor_type: "Aggregator", default_vendor: "Relay Messaging", is_active: 1, priceBand: 0.025, daily: 5200 },
  { product_code: "MSG-EMAIL", name: "Transactional email", category: "Messaging", unit: "1K emails", vendor_type: "Direct", default_vendor: "Relay Messaging", is_active: 1, priceBand: 0.9, daily: 150 },
  { product_code: "MSG-VOICE-OUT", name: "Outbound call", category: "Messaging", unit: "minute", vendor_type: "Aggregator", default_vendor: "Northbeam Telecom", is_active: 1, priceBand: 0.014, daily: 9000 },
  { product_code: "MSG-FAX", name: "Fax (legacy)", category: "Messaging", unit: "page", vendor_type: "Aggregator", default_vendor: "Northbeam Telecom", is_active: 0, priceBand: 0.07, daily: 200 },
  // Data: search, maps and documents.
  { product_code: "DAT-SEARCH", name: "Search API", category: "Data", unit: "1K queries", vendor_type: "Aggregator", default_vendor: "Tessel Labs", is_active: 1, priceBand: 5.0, daily: 45 },
  { product_code: "DAT-CRAWL", name: "Web crawl", category: "Data", unit: "1K pages", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 1.0, daily: 180 },
  { product_code: "DAT-GEOCODE", name: "Geocoding", category: "Data", unit: "1K requests", vendor_type: "Aggregator", default_vendor: "Mapline", is_active: 1, priceBand: 5.0, daily: 40 },
  { product_code: "DAT-ROUTES", name: "Route optimisation", category: "Data", unit: "1K requests", vendor_type: "Aggregator", default_vendor: "Mapline", is_active: 1, priceBand: 10.0, daily: 18 },
  { product_code: "DAT-DOCPARSE", name: "Document parsing", category: "Data", unit: "page", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.01, daily: 16000 },
  { product_code: "DAT-VECTOR", name: "Vector storage", category: "Data", unit: "GB-day", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 0.1, daily: 1400 },
  // Compute: GPUs and fine-tuning.
  { product_code: "GPU-H100", name: "H100 GPU · on-demand", category: "Compute", unit: "GPU-hour", vendor_type: "Aggregator", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 2.49, daily: 96 },
  { product_code: "GPU-H100-SPOT", name: "H100 GPU · spot", category: "Compute", unit: "GPU-hour", vendor_type: "Aggregator", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 1.6, daily: 130 },
  { product_code: "GPU-A100", name: "A100 GPU · on-demand", category: "Compute", unit: "GPU-hour", vendor_type: "Aggregator", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 1.29, daily: 160 },
  { product_code: "FT-ATL-FLASH", name: "Fine-tuning · Atlas Flash", category: "Compute", unit: "1M training tokens", vendor_type: "Direct", default_vendor: "Cumulus Cloud", is_active: 1, priceBand: 3.0, daily: 40 },
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
