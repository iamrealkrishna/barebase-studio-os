"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Tab } from "@/lib/nav";

import styles from "./Tabs.module.css";

/** Route-based tabs: each tab is a URL, never local state (UI spec 2, Component API). */
export function Tabs({ items, label }: { items: Tab[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={styles.tabs}>
      <ul>
        {items.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={styles.tab}
                data-active={active || undefined}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
