import type { ComponentType, ReactNode } from "react";

/** Who a doc applies to. "all" = any signed-in user. */
export type DocRole = "admin" | "all";

export type GuideMeta = {
  slug: string;
  title: string;
  /** One-sentence summary shown on index cards and in nav tooltips. */
  summary: string;
  /** Logical grouping on the How-to index, e.g. "Daily work", "Pricing", "Admin". */
  group: string;
  role: DocRole;
  /** Rough reading/doing time in minutes. */
  minutes?: number;
};

export type GuideModule = {
  meta: GuideMeta;
  Body: ComponentType;
};

export type FeatureMeta = {
  slug: string;
  title: string;
  summary: string;
  /** Lucide icon name rendered on index cards (must exist in help icon map). */
  icon?: string;
  /** Primary in-app routes this feature lives at, e.g. ["/accounts"]. */
  routes?: string[];
  role: DocRole;
  /** Grouping on the Features index, e.g. "Dashboard", "Billing", "Admin". */
  group: string;
};

export type FeatureModule = {
  meta: FeatureMeta;
  Body: ComponentType;
};

export type ReleaseNote = {
  /** Sequential build number, oldest = 1. */
  build: number;
  /** ISO date the build landed on main. */
  date: string;
  title: string;
  /** PR number on GitHub, if the build landed via PR. */
  pr?: number;
  /** Short commit sha(s). */
  shas?: string[];
  /** Files-changed summary, e.g. "42 files · +3.1k −400". */
  diffstat?: string;
  /** User-visible changes. */
  highlights: ReactNode[];
  /** Schema migrations, deps, env vars, API changes — the engineering record. */
  technical?: ReactNode[];
  fixes?: ReactNode[];
  /**
   * Flag this build as a product milestone — a capability leap that reads as a
   * chapter in the product story, not just another increment. Milestones get an
   * accented node on the timeline and a jump-nav chip at the top of the changelog.
   */
  milestone?: boolean;
  /** Short milestone label, e.g. "Pricing models". Shown on the badge and jump-nav. */
  milestoneLabel?: string;
};
