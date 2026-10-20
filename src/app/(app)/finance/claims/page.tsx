import { Placeholder } from "@/components/Placeholder";
import { FINANCE_TABS } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance-claims").title };

export default function FinanceClaimsPage() {
  return <Placeholder screenKey="finance-claims" tabs={{ label: "Finance", items: FINANCE_TABS }} />;
}
