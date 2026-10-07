import { requireSession } from "@/lib/access";

// The admin section is no longer uniformly admin-only: `editor` reaches the
// manual-entries screens nested here. So the layout only requires a session;
// each page below carries its own guard (requireRole("admin") for the
// admin-only surfaces, requireCan(...) for the ones editors share).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <>{children}</>;
}
