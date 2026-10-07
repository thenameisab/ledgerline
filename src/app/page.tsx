import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Landing } from "@/components/landing/Landing";
import { DEMO_ACCESS_COOKIE } from "@/lib/demo-access";

export const metadata: Metadata = {
  title: "Ledgerline · Usage-based billing for every SKU",
  description:
    "Ledgerline prices usage for companies that sell many products, APIs or models, and turns it into invoices and margin. Try the live demo with fictional data.",
};

export default function LandingPage() {
  const hasAccess = cookies().get(DEMO_ACCESS_COOKIE)?.value === "1";
  return <Landing hasAccess={hasAccess} />;
}
