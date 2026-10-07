import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Landing } from "@/components/landing/Landing";
import { DEMO_ACCESS_COOKIE } from "@/lib/demo-access";

export const metadata: Metadata = {
  title: "Ledgerline · Billing and revenue for API businesses",
  description:
    "Ledgerline turns API usage into priced revenue, invoices and margin. Try the live demo with fictional data.",
};

export default function LandingPage() {
  const hasAccess = cookies().get(DEMO_ACCESS_COOKIE)?.value === "1";
  return <Landing hasAccess={hasAccess} />;
}
