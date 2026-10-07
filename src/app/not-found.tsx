import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { StatusBar } from "@/components/StatusBar";
import { Compass } from "lucide-react";

export const metadata: Metadata = {
  title: "Ledgerline · Page not found",
};

export default function NotFound() {
  return (
    <main>
      <StatusBar title="Page not found" subtitle="That route doesn't exist in Ledgerline" />
      <div className="px-7 py-16 max-w-2xl mx-auto">
        <div
          className="elev-1 bg-bg-raised rounded-md px-8 py-12 text-center dash-enter"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <div
            aria-hidden
            className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-bg-sunken text-ink-muted mx-auto mb-5"
          >
            <Compass size={20} strokeWidth={1.5} />
          </div>
          <h2 className="font-serif text-3xl text-ink leading-tight mb-2" style={{ fontWeight: 600 }}>
            We can&apos;t find that page.
          </h2>
          <p className="text-base text-ink-muted leading-normal max-w-md mx-auto">
            The link may be stale or the route hasn&apos;t shipped yet. Head back to
            the dashboard and pick up from there.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className={buttonClass({ variant: "primary", size: "md" })}
            >
              Back to dashboard
            </Link>
            <Link
              href="/accounts"
              className={buttonClass({ variant: "secondary", size: "md" })}
            >
              Browse accounts
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
