import { Placeholder } from "@/components/Placeholder";
import { FINANCE_TABS } from "@/lib/nav";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance-reimbursements").title };

export default function FinanceReimbursementsPage() {
  return <Placeholder screenKey="finance-reimbursements" tabs={{ label: "Finance", items: FINANCE_TABS }} />;
}
