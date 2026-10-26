import { Placeholder } from "@/components/Placeholder";
import { FINANCE_TABS } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance").title };

export default function FinancePage() {
  return <Placeholder screenKey="finance" tabs={{ label: "Finance", items: FINANCE_TABS }} />;
}
