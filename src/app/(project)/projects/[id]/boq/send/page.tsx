import { Placeholder } from "@/components/Placeholder";
import { screen } from "@/lib/screens";
import { loadShellProject } from "@/lib/shell-project";

export const dynamic = "force-dynamic";

export const metadata = { title: screen("boq-send").title };

export default async function BoqSendPage({ params }: { params: Promise<{ id: string }> }) {
  const { project } = await loadShellProject((await params).id);
  return (
    <Placeholder
      screenKey="boq-send"
      project={{ id: project.id, name: project.name }} workingToday={[
        { label: "Create a client link and save a version as Sent (Versions & Approvals)", href: `/projects/${project.id}/boq/versions` },
        { label: "Preview what the client sees", href: `/projects/${project.id}/boq/client-view` },
      ]}
    />
  );
}
