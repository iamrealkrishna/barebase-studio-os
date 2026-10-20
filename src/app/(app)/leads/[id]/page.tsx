import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("lead").title };

export default function LeadPage() {
  return <Placeholder screenKey="lead" breadcrumb={[{ label: "Leads", href: "/leads" }]} />;
}
