"use client";

import Link from "next/link";

export type ProjectTab = "build" | "clientview" | "versions";

export default function ProjectBar({
  projectId,
  projectName,
  active,
  right,
}: {
  projectId: string;
  projectName: string;
  active: ProjectTab;
  right?: React.ReactNode;
}) {
  const tab = (key: ProjectTab, href: string, label: string) => (
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
        {tab("build", `/projects/${projectId}/build`, "Build BOQ")}
        {tab("clientview", `/projects/${projectId}/client-view`, "Client View")}
        {tab("versions", `/projects/${projectId}`, "Versions & Approvals")}
      </nav>

      <div className="topbar-actions">{right}</div>
    </div>
  );
}
