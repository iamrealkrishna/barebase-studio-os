import { Placeholder } from "@/components/Placeholder";
import { SETTINGS_TABS } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("rate-card").title };

export default function RateCardPage() {
  return <Placeholder screenKey="rate-card" tabs={{ label: "Org Settings", items: SETTINGS_TABS }} />;
}
