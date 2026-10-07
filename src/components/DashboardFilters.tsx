"use client";
import { DateRangePicker } from "./ui/DateRangePicker";

export function DashboardFilters({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Dashboard filters">
      <DateRangePicker from={from} to={to} />
    </div>
  );
}
