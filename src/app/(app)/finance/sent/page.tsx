import { Placeholder } from "@/components/Placeholder";
import { FINANCE_TABS } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance-sent").title };

export default function FinanceSentPage() {
  return <Placeholder screenKey="finance-sent" tabs={{ label: "Finance", items: FINANCE_TABS }} />;
}
