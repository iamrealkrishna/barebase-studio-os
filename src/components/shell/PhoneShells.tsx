import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Tabs } from "@/components/ui/Tabs";
import type { Tab } from "@/lib/nav";

import styles from "./phone.module.css";

/**
 * Client portal frame: letterhead header, then tabs. Phone first, no staff
 * session (UI spec 3 layout tree, screens ClientPortal.png).
 */
export function ClientShell({
  projectName,
  clientName,
  tabs,
  children,
}: {
  projectName: string;
  clientName: string;
  tabs: Tab[];
  children: React.ReactNode;
}) {
  return (
    <div className={styles.phone}>
      <header className={styles.letterhead}>
        <span className={styles.mark} aria-hidden>
          B
        </span>
        <div>
          <p className={styles.brand}>Barebase</p>
          <p className={styles.sub}>
            {projectName} · for {clientName}
          </p>
        </div>
      </header>
      <div className={styles.tabs}>
        <Tabs label="Your home" items={tabs} />
      </div>
      <main className={styles.body}>{children}</main>
    </div>
  );
}

/**
 * Site screens on a phone (DPR, raise a snag): dark header with a back link,
 * no sidebar, the main action at the bottom (screens PhoneDPR.png, PhoneSnag.png).
 */
export function SiteShell({
  backHref,
  backLabel,
  children,
}: {
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.phone}>
      <header className={styles.siteHeader}>
        <Link href={backHref} className={styles.back}>
          <ArrowLeft aria-hidden size={16} strokeWidth={1.75} />
          {backLabel}
        </Link>
      </header>
      <main className={styles.body}>{children}</main>
    </div>
  );
}
