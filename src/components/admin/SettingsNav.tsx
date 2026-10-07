import { getSessionUser } from "@/lib/access";
import { SettingsTabs } from "./SettingsTabs";

// Server-side wrapper: reads the signed-in role
// so every Settings page adds the tab strip with one line and can't drift on
// which tabs it shows. Render it directly under the page's StatusBar.
export async function SettingsNav() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <div className="border-b border-border bg-bg px-7 py-3">
      <SettingsTabs role={user.role ?? "member"} />
    </div>
  );
}
