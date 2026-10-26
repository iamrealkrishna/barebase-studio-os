import { Placeholder } from "@/components/Placeholder";
import { FINANCE_TABS } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance-tax").title };

export default function FinanceTaxPage() {
  return <Placeholder screenKey="finance-tax" tabs={{ label: "Finance", items: FINANCE_TABS }} />;
}
