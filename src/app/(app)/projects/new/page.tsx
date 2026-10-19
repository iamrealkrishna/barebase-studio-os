import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";

export const metadata = { title: screen("project-new").title };

export default function ProjectNewPage() {
  return <Placeholder screenKey="project-new" breadcrumb={[{ label: "Projects", href: "/projects" }]} />;
}
