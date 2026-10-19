import { Placeholder } from "@/components/Placeholder";
import { SETTINGS_TABS } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("settings").title };

export default function SettingsPage() {
  return <Placeholder screenKey="settings" tabs={{ label: "Org Settings", items: SETTINGS_TABS }} />;
}
