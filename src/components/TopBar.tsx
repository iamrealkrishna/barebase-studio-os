"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/actions/auth";
import type { SessionUser } from "@/lib/auth";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function TopBar({ user }: { user: SessionUser }) {
  const pathname = usePathname() ?? "";
  const onProjects = pathname.startsWith("/projects");
  const onSettings = pathname.startsWith("/settings");
  const onTeam = pathname.startsWith("/team");
  const onAccount = pathname.startsWith("/account");
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
        <Link
          href="/account"
          className={`user-chip${onAccount ? " active" : ""}`}
          title="Your account — profile, password and what your role can do"
        >
          <span className="user-avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <span className="user-meta">
            <span className="who">{user.name}</span>
            <span className="role">{isAdmin ? "Admin" : "Team member"}</span>
          </span>
        </Link>
        <form action={signOut}>
          <button type="submit" className="linkbtn">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
