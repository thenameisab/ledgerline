import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { buttonClass } from "@/components/ui/Button";
import { LoginAurora } from "@/components/auth/LoginAurora";
import { Glyph } from "@/components/ui/Glyph";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; callbackUrl?: string };
}) {
  if (config.auth.bypassAuth) redirect("/dashboard");
  const session = await auth();
  const callbackUrl = searchParams.callbackUrl ?? "/dashboard";
  if (session?.user) redirect(callbackUrl);

  // Demo sign-in: two one-click roles signed in via the dev-only
  // Credentials provider (POST through a server action so NextAuth gets a CSRF
  // token). The emails must match seeded active users.
  const adminSignIn = async () => {
    "use server";
    await signIn("demo", { email: "admin@ledgerline.local", redirectTo: callbackUrl });
  };
  const memberSignIn = async () => {
    "use server";
    await signIn("demo", { email: "analyst@ledgerline.local", redirectTo: callbackUrl });
  };

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[7fr_5fr]">
      {/* Brand panel — desktop only. The flutes: drifting light ribbons behind
          fluted glass, pure CSS. The auth column stays self-sufficient on
          mobile, where the panel would only cost bytes. */}
      <aside className="hidden border-r border-border lg:block lg:h-screen">
        <LoginAurora />
      </aside>

      {/* Auth column */}
      <section className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-12">
        <div className="dash-enter mx-auto w-full max-w-sm">
          <div className="inline-block leading-tight">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-accent text-bg-raised shadow-bevel">
                <Glyph size={18} />
              </span>
              <h1 className="landmark-wipe font-display text-4xl text-ink" style={{ fontWeight: 600 }}>
                Ledgerline
              </h1>
            </div>
            {/* The rail under the wordmark is the AI gradient, not the accent —
                the one place on this screen the two families meet. */}
            <div className="landmark-rail mt-2 h-px bg-ai" aria-hidden />
          </div>
          <div className="mt-2 text-sm text-ink-muted">Billing &amp; invoicing</div>

          <p className="mt-10 font-display text-2xl text-ink">Let&apos;s see the numbers.</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            This is a portfolio demo. Pick a role to explore — an{" "}
            <span className="text-ink">Admin</span> sees everything (pricing, margin, invoicing,
            settings); a <span className="text-ink">Member</span> gets the read-only analyst view.
          </p>

          <div className="mt-6 space-y-3">
            <form action={adminSignIn}>
              <button
                type="submit"
                className={`${buttonClass({ variant: "primary", size: "lg" })} w-full`}
              >
                Enter as Admin
              </button>
            </form>
            <form action={memberSignIn}>
              <button
                type="submit"
                className={`${buttonClass({ variant: "secondary", size: "lg" })} w-full`}
              >
                Enter as Member
              </button>
            </form>
          </div>

          {searchParams.error && (
            <div className="mt-5 rounded-md border border-bad bg-bad-bg p-4 text-sm text-bad-ink">
              {decodeError(searchParams.error)}
            </div>
          )}

          <div className="mt-7 text-xs leading-relaxed text-ink-faint">
            Demo accounts — Admin: Maya Sharma · Member: Rohan Mehta. Pricing edits and configuration
            changes are audited. No real data; all companies are fictional.
          </div>
        </div>
      </section>
    </main>
  );
}

function decodeError(code: string): string {
  switch (code) {
    case "AccessDenied":
      return "This user is not active. Run the seed again, or wait for the nightly reset.";
    case "Configuration":
      return "Auth isn't configured. Check that AUTH_SECRET is set.";
    default:
      return `Sign-in error: ${code}`;
  }
}
