import { Bell, Check, Search } from "lucide-react";
import Link from "next/link";

import styles from "./shell.module.css";

/**
 * Top bar on every staff page: global search, "to approve" and the bell
 * (screens-and-journeys.md: Approvals is reached from here, not the sidebar),
 * then the profile avatar. Counts arrive with Phase 2 approvals and notifications.
 */
export function TopBar() {
  return (
    <header className={styles.topbar}>
      <form role="search" className={styles.search} action="/projects">
        <Search aria-hidden size={16} strokeWidth={1.75} />
        <label htmlFor="global-search" className="visually-hidden">
          Search projects, leads, clients
        </label>
        <input id="global-search" name="q" type="search" placeholder="Search projects, leads, clients…" />
      </form>
      <div className={styles.topActions}>
        <Link href="/approvals" className={styles.approvePill}>
          <Check aria-hidden size={14} strokeWidth={2} />
          <span>To approve</span>
        </Link>
        <Link href="/notifications" className={styles.iconButton} aria-label="Notifications" title="Notifications">
          <Bell aria-hidden size={20} strokeWidth={1.75} />
        </Link>
        <Link href="/profile" className={styles.avatar} aria-label="Profile" title="Profile">
          KA
        </Link>
      </div>
    </header>
  );
}
