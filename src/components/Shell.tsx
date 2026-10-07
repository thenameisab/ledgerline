import { cookies, headers } from "next/headers";
import { getSessionUser } from "@/lib/access";
import { SideNav } from "@/components/nav/SideNav";
import { SidebarShell } from "@/components/nav/SidebarShell";
import { KeyboardShortcuts } from "@/components/nav/KeyboardShortcuts";
import { CommandPalette } from "@/components/cmd/CommandPalette";
import { TooltipProvider } from "@/components/ui/TooltipProvider";

export const SIDEBAR_COLLAPSED_COOKIE = "sb-collapsed";

const STANDALONE_PREFIXES = ["/login"];

export async function Shell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const pathname = headers().get("x-invoke-path") ?? headers().get("x-pathname") ?? "";
  const isStandalone = pathname === "/" || STANDALONE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user || isStandalone) {
    return (
      <TooltipProvider>
        <div className="min-h-screen">{children}</div>
      </TooltipProvider>
    );
  }

  const collapsed = cookies().get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";

  return (
    <TooltipProvider>
      <KeyboardShortcuts role={user.role} />
      <CommandPalette role={user.role} />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="flex h-screen overflow-hidden">
        <SidebarShell initialCollapsed={collapsed}>
          <SideNav />
        </SidebarShell>
        <div id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto outline-none">
          {children}
        </div>
      </div>
    </TooltipProvider>
  );
}
