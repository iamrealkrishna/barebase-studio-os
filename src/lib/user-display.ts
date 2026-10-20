import type { SessionUser } from "./auth";

/** "Krishna Agarwal" -> "KA", "Ridhi" -> "RI". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The name, role and initials the shell shows for the signed-in person. */
export function shellUser(user: SessionUser) {
  return {
    name: user.name,
    initials: initials(user.name),
    // BOQ Studio has two roles today; the seven Studio OS roles arrive in Phase 0 (P0-7).
    roleLabel: user.role === "ADMIN" ? "Admin" : "Team member",
  };
}
