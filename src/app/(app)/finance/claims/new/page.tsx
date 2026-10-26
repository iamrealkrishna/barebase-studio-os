import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("finance-claim-new").title };

export default function FinanceClaimNewPage() {
  return <Placeholder screenKey="finance-claim-new" breadcrumb={[{ label: "My claims", href: "/finance/claims" }]} />;
}
