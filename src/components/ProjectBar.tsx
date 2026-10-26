"use client";

import Link from "next/link";

export type ProjectTab = "build" | "clientview" | "review" | "versions";

export default function ProjectBar({
  projectId,
  projectName,
  active,
  right,
  reviewFlag,
}: {
  projectId: string;
  projectName: string;
  active: ProjectTab;
  right?: React.ReactNode;
  /** Count of lines the client rejected or commented on, shown on the tab. */
  reviewFlag?: number;
}) {
  const tab = (key: ProjectTab, href: string, label: React.ReactNode) => (
    <Link key={key} href={href} className={`nav-link${active === key ? " active" : ""}`}>
      {label}
    </Link>
  );

  return (
    <div className="topbar" style={{ background: "var(--dark-2)", padding: "8px 22px" }}>
      <div className="brand">
        <Link href="/projects" className="linkbtn" style={{ textDecoration: "none", fontSize: 12 }}>
          ← All projects
        </Link>
        <span className="mark" style={{ fontSize: 17 }}>
          {projectName}
        </span>
      </div>

      <nav className="page-toggle" style={{ background: "var(--ink)" }}>
        {tab("build", `/projects/${projectId}/boq`, "Build BOQ")}
        {tab("clientview", `/projects/${projectId}/boq/client-view`, "Client View")}
        {tab(
          "review",
          `/projects/${projectId}/boq/review`,
          <>
            Client Review
            {reviewFlag ? <span className="tab-flag">{reviewFlag}</span> : null}
          </>,
        )}
        {tab("versions", `/projects/${projectId}/boq/versions`, "Versions & Approvals")}
      </nav>

      <div className="topbar-actions">{right}</div>
    </div>
  );
}
