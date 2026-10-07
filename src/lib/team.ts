// Internal team rosters for account ownership. These are fixed people lists
// (not app-login users), used to populate the CS/Sales owner pickers on the
// account profile and to validate saved values server-side.

export const CS_TEAM = [
  "Ananya Iyer",
  "Kabir Malhotra",
  "Meera Pillai",
  "Devansh Joshi",
] as const;

export const SALES_TEAM = [
  "Nisha Verma",
  "Rahul Desai",
  "Ishaan Kapoor",
  "Tara Menon",
  "Vikram Shetty",
] as const;

export type CsOwner = (typeof CS_TEAM)[number];
export type SalesOwner = (typeof SALES_TEAM)[number];
