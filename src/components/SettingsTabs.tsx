import { Tabs } from "@/components/ui/Tabs";
import { SETTINGS_TABS } from "@/lib/nav";

/** Org Settings tabs (OrgSettings.png). Approval slabs and Billing and numbering arrive in Phase 2. */
export function SettingsTabs() {
  return (
    <div style={{ marginBottom: "var(--bb-space-4)" }}>
      <Tabs label="Org Settings" items={SETTINGS_TABS} />
    </div>
  );
}
