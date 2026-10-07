import { getSessionUser } from "@/lib/access";
import type { Role } from "@/lib/repos/users";

export async function RoleGate({
  role,
  children,
  fallback = null,
}: {
  role: Role;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const u = await getSessionUser();
  if (!u) return <>{fallback}</>;
  if (role === "admin" && u.role !== "admin") return <>{fallback}</>;
  return <>{children}</>;
}
