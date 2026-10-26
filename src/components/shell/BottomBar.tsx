"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BOTTOM_NAV, isActive } from "@/lib/nav";

import { NavIcon } from "./NavIcon";
import styles from "./shell.module.css";

/** Under 768 px the sidebar becomes this five-item bar (UI spec 3, reference 00-app-shell). */
export function BottomBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={styles.bottomBar}>
      <ul>
        {BOTTOM_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const isCentre = item.icon === "plus";
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={isCentre ? styles.bottomCentre : styles.bottomItem}
                data-active={active || undefined}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
              >
                <NavIcon name={item.icon} />
                {!isCentre && <span>{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
