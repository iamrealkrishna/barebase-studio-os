"use client";

import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/actions/auth";
import { isActive, type NavItem, type Tab } from "@/lib/nav";

import { NavIcon } from "./NavIcon";
import styles from "./shell.module.css";

type SidebarProps = {
  items: NavItem[];
  footerItem?: NavItem;
  /** Set inside a project: the back link, project name and client line above the tabs. */
  project?: { name: string; subtitle: string; menu: Tab[] };
  /** Items whose href must match exactly (a project's Overview). */
  exactHrefs?: string[];
  /** The signed-in person, for the chip at the bottom. */
  user: { name: string; roleLabel: string; initials: string };
};

/** The dark left sidebar: global areas, or a project's tabs once inside one. */
export function Sidebar({ items, footerItem, project, exactHrefs = [], user }: SidebarProps) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href, exactHrefs.includes(item.href), item.matches);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={styles.navItem}
          data-active={active || undefined}
          aria-current={active ? "page" : undefined}
          title={item.label}
        >
          <NavIcon name={item.icon} />
          <span className={styles.navLabel}>{item.label}</span>
        </Link>
        {item.children && active && (
          <ul className={styles.subNav}>
            {item.children.map((child) => {
              const childActive = pathname === child.href;
              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    className={styles.subNavItem}
                    data-active={childActive || undefined}
                    aria-current={childActive ? "page" : undefined}
                  >
                    {child.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand} aria-label="Barebase Platform, home">
        <span className={styles.brandMark} aria-hidden>
          B
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>Barebase</span>
          <span className={styles.brandSub}>Platform</span>
        </span>
      </Link>

      {project && (
        <div className={styles.projectHead}>
          <Link href="/projects" className={styles.backLink}>
            <ArrowLeft aria-hidden size={16} strokeWidth={1.75} />
            <span className={styles.navLabel}>All Projects</span>
          </Link>
          <p className={styles.projectName}>{project.name}</p>
          <p className={styles.projectSub}>{project.subtitle}</p>
        </div>
      )}

      <nav aria-label={project ? "Project" : "Main"} className={styles.nav}>
        <ul>{items.map(renderItem)}</ul>
      </nav>

      {project && (
        <nav aria-label="Project menu" className={styles.projectMenu}>
          <p className={styles.menuLabel}>Project menu</p>
          <ul>
            {project.menu.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={styles.subNavItem}
                  data-active={pathname === tab.href || undefined}
                  aria-current={pathname === tab.href ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className={styles.sidebarFooter}>
        {footerItem && <ul>{renderItem(footerItem)}</ul>}
        <Link href="/account" className={styles.userChip} title="Your account: profile, password and what your role can do">
          <span className={styles.avatar} aria-hidden>
            {user.initials}
          </span>
          <span className={styles.navLabel}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{user.roleLabel}</span>
          </span>
        </Link>
        <form action={signOut}>
          <button type="submit" className={styles.signOut} aria-label="Sign out" title="Sign out">
            <LogOut aria-hidden size={16} strokeWidth={1.75} />
            <span className={styles.navLabel}>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
