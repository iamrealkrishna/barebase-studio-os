import Link from "next/link";

import { signOut } from "@/actions/auth";
import AccountProfileForm from "@/components/AccountProfileForm";
import OwnPasswordForm from "@/components/OwnPasswordForm";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/boq";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function AccountPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const [record, org, recentProjects] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        createdAt: true,
        _count: { select: { projects: true, versions: true } },
      },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: user.orgId },
      select: { name: true, legalName: true },
    }),
    // Projects this person started, most recently touched first — a way back
    // into your own work without scanning the whole org's list.
    prisma.project.findMany({
      where: { orgId: user.orgId, createdById: user.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, clientName: true, updatedAt: true },
    }),
  ]);

  return (
    <div className="settings-wrap">
      <div className="proj-head-row">
        <span className="proj-title">Your account</span>
      </div>

      <div className="account-card">
        <div className="account-avatar" aria-hidden="true">
          {initials(record.name)}
        </div>
        <div className="account-id">
          <h2>{record.name}</h2>
          <div className="account-email">{record.email}</div>
          <div className="account-badges">
            <span className={`status-badge ${isAdmin ? "approved" : "draft"}`}>
              {isAdmin ? "Admin" : "Team member"}
            </span>
            <span className="account-org">{org.legalName || org.name}</span>
          </div>
        </div>
        <div className="account-stats">
          <div className="account-stat">
            <span className="n tabular">{record._count.projects}</span>
            <span className="l">Projects started</span>
          </div>
          <div className="account-stat">
            <span className="n tabular">{record._count.versions}</span>
            <span className="l">Versions issued</span>
          </div>
          <div className="account-stat">
            <span className="n">{fmtDate(record.createdAt)}</span>
            <span className="l">Member since</span>
          </div>
        </div>
      </div>

      <AccountProfileForm name={record.name} email={record.email} />

      <OwnPasswordForm />

      <div className="settings-section">
        <h3>
          What your role can do <span className="note">— every one of these is checked on the server</span>
        </h3>

        <table className="role-table">
          <tbody>
            <tr>
              <td>Build BOQs, add sections and line items, export the Client PDF</td>
              <td className="yn yes">Yes</td>
            </tr>
            <tr>
              <td>Version a BOQ, send it to a client, manage client contacts and approvals</td>
              <td className="yn yes">Yes</td>
            </tr>
            <tr>
              <td>Duplicate a project and import lines from another one</td>
              <td className="yn yes">Yes</td>
            </tr>
            <tr>
              <td>See internal cost and margin, and export the Internal PDF</td>
              <td className={`yn ${isAdmin ? "yes" : "no"}`}>{isAdmin ? "Yes" : "Admins only"}</td>
            </tr>
            <tr>
              <td>Edit the rate card, including bulk CSV import</td>
              <td className={`yn ${isAdmin ? "yes" : "no"}`}>{isAdmin ? "Yes" : "Admins only"}</td>
            </tr>
            <tr>
              <td>Change the letterhead and default terms</td>
              <td className={`yn ${isAdmin ? "yes" : "no"}`}>{isAdmin ? "Yes" : "Admins only"}</td>
            </tr>
            <tr>
              <td>Add team members, change roles, reset passwords</td>
              <td className={`yn ${isAdmin ? "yes" : "no"}`}>{isAdmin ? "Yes" : "Admins only"}</td>
            </tr>
          </tbody>
        </table>

        <p className="hint-text">
          {isAdmin ? (
            <>
              You&apos;re an admin, so nothing in the app is hidden from you. Roles are changed on the{" "}
              <Link href="/team">Team</Link>
              {" "}page — and the last active admin can&apos;t be demoted, so there&apos;s always someone who can let
              people back in.
            </>
          ) : (
            <>Need one of the admin-only items? Ask an admin to change your role on the Team page.</>
          )}
        </p>
      </div>

      <div className="settings-section">
        <h3>
          Your projects <span className="note">— the five you started most recently</span>
        </h3>

        {recentProjects.length === 0 ? (
          <div className="mini-empty">
            You haven&apos;t started a project yet. <Link href="/projects">Start one</Link> — projects a colleague
            created are all still visible to you on the Projects page.
          </div>
        ) : (
          <table className="mini-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Last saved</th>
              </tr>
            </thead>
            <tbody>
              {recentProjects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <Link href={`/projects/${project.id}/boq`}>
                      <b>{project.name}</b>
                    </Link>
                  </td>
                  <td>{project.clientName || "—"}</td>
                  <td>{fmtDate(project.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="settings-section">
        <h3>
          Session <span className="note">— signed in on this device</span>
        </h3>
        <p className="hint-text" style={{ marginTop: 0 }}>
          Signing in sets a cookie that lasts 30 days. Signing out clears it on this device only.
        </p>
        <form action={signOut}>
          <button type="submit" className="btn danger-outline small">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
