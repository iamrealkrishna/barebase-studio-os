import { Placeholder } from "@/components/Placeholder";
import { FINANCE_TABS } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance-transactions").title };

export default function FinanceTransactionsPage() {
  return <Placeholder screenKey="finance-transactions" tabs={{ label: "Finance", items: FINANCE_TABS }} />;
}
