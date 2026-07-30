import Link from "next/link";

import DuplicateProjectButton from "@/components/DuplicateProjectButton";
import NewProjectForm from "@/components/NewProjectForm";
import { requireUser } from "@/lib/auth";
import { computeQty, fmt, fmtDate, statusClass, statusLabel } from "@/lib/boq";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { orgId: user.orgId },
    orderBy: { updatedAt: "desc" },
    include: {
      sections: {
        select: {
          items: {
            select: { rate: true, qty: true, qtyOverride: true, unit: true, dimL: true, dimB: true, dimH: true },
          },
        },
      },
      _count: { select: { versions: true } },
      versions: { where: { status: "APPROVED" }, orderBy: { number: "desc" }, take: 1 },
    },
  });

  const rows = projects.map((project) => {
    let total = 0;
    for (const section of project.sections) {
      for (const item of section.items) {
        const qty = computeQty({
          unit: item.unit,
          qty: item.qty,
          qtyOverride: item.qtyOverride,
          dims: {
            l: item.dimL === null ? "" : String(item.dimL),
            b: item.dimB === null ? "" : String(item.dimB),
            h: item.dimH === null ? "" : String(item.dimH),
          },
        });
        total += qty * item.rate;
      }
    }
    return {
      id: project.id,
      name: project.name,
      client: project.clientName || "—",
      versions: project._count.versions,
      updatedAt: project.updatedAt,
      total,
      status: project.status,
      approved: project.versions[0] ?? null,
    };
  });

  return (
    <div className="settings-wrap">
      <div className="proj-head-row">
        <span className="proj-title">Projects</span>
      </div>

      <NewProjectForm />

      {rows.length === 0 ? (
        <div className="no-versions">No projects yet — add one above to start a BOQ.</div>
      ) : (
        <div className="proj-table">
          <div className="proj-thead">
            <span className="pc-num">S.No</span>
            <span className="pc-name">Project</span>
            <span className="pc-client">Client</span>
            <span className="pc-vers">Versions</span>
            <span className="pc-date">Last saved</span>
            <span className="pc-amt">Current value</span>
            <span className="pc-status">Status</span>
            <span className="pc-actions" />
          </div>
          {rows.map((row, i) => (
            <div key={row.id} className="proj-row">
              <Link href={`/projects/${row.id}/build`} className="proj-row-main" style={{ color: "inherit" }}>
                <span className="pc-num tabular">{i + 1}</span>
                <span className="pc-name">{row.name}</span>
                <span className="pc-client">{row.client}</span>
                <span className="pc-vers tabular">{row.versions}</span>
                <span className="pc-date">{fmtDate(row.updatedAt)}</span>
                <span className="pc-amt tabular">{fmt(row.total)}</span>
                <span className="pc-status">
                  {row.approved ? (
                    <span className="status-badge approved">✓ Approved by client</span>
                  ) : (
                    <span className={`status-badge ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>
                  )}
                </span>
              </Link>
              <span className="pc-actions">
                <DuplicateProjectButton
                  projectId={row.id}
                  projectName={row.name}
                  clientName={row.client === "—" ? "" : row.client}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
