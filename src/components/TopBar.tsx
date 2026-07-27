"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/actions/auth";
import type { SessionUser } from "@/lib/auth";

export default function TopBar({ user }: { user: SessionUser }) {
  const pathname = usePathname() ?? "";
  const onProjects = pathname.startsWith("/projects");
  const onSettings = pathname.startsWith("/settings");
  const onTeam = pathname.startsWith("/team");
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="topbar">
      <div className="brand">
        <span className="mark">BAREBASE</span>
        <span className="sub">BOQ Studio</span>
      </div>

      <nav className="page-toggle">
        <Link href="/projects" className={`nav-link${onProjects ? " active" : ""}`}>
          Projects
        </Link>
        <Link href="/settings" className={`nav-link${onSettings ? " active" : ""}`}>
          Rate Card &amp; Settings
        </Link>
        {/* Admin-only. The page itself calls requireAdmin, so this is presentation. */}
        {isAdmin ? (
          <Link href="/team" className={`nav-link${onTeam ? " active" : ""}`}>
            Team
          </Link>
        ) : null}
      </nav>

      <div className="topbar-user">
        <span className="who">
          {user.name} · {user.role === "ADMIN" ? "Admin" : "Team"}
        </span>
        <form action={signOut}>
          <button type="submit" className="linkbtn">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
