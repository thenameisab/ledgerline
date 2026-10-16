import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "Ledgerline · Usage-based billing for every SKU",
  description:
    "Ledgerline prices usage for companies that sell many products, APIs or models, and turns it into invoices and margin. Try the live demo with fictional data.",
};

export default function LandingPage() {
  return <Landing />;
}
