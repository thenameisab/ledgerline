import { FilterPill } from "./ui/FilterPill";

/** Segmented switch between the Accounts list and the Groups (group) view. */
export function AccountsViewToggle({ active }: { active: "accounts" | "groups" }) {
  return (
    <div role="tablist" className="inline-flex items-center gap-1.5">
      <FilterPill label="Accounts" active={active === "accounts"} href="/accounts" />
      <FilterPill label="Groups" active={active === "groups"} href="/accounts/groups" />
    </div>
  );
}
