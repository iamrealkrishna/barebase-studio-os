import { Placeholder } from "@/components/Placeholder";
import { FINANCE_TABS } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance-billing").title };

export default function FinanceBillingPage() {
  return <Placeholder screenKey="finance-billing" tabs={{ label: "Finance", items: FINANCE_TABS }} />;
}
