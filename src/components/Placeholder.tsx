import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { Tabs } from "@/components/ui/Tabs";
import type { Tab } from "@/lib/nav";
import { mockupUrl, screen, titleFromSlug, type ScreenKey } from "@/lib/screens";

import styles from "./Placeholder.module.css";

type PlaceholderProps = {
  screenKey: ScreenKey;
  /** Inside a project: its id, for the breadcrumb. */
  projectId?: string;
  /** Section tabs shown above the content (Finance, BOQ, Home budget and so on). */
  tabs?: { label: string; items: Tab[] };
  /** Breadcrumb trail ahead of the title, outside a project. */
  breadcrumb?: { label: string; href: string }[];
};

/**
 * Stand-in for a screen that isn't built yet. Shows its title in the right shell,
 * what it will do, who it's for, its spec sections and a link to its mock-up,
 * so the whole navigation can be clicked through (prompts/00-kickoff.md, step 3).
 */
export function Placeholder({ screenKey, projectId, tabs, breadcrumb }: PlaceholderProps) {
  const s = screen(screenKey);
  const trail =
    breadcrumb ??
    (projectId
      ? [
          { label: "Projects", href: "/projects" },
          { label: titleFromSlug(projectId), href: `/projects/${projectId}` },
        ]
      : []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {trail.length > 0 && (
          <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
            <ol>
              {trail.map((crumb) => (
                <li key={crumb.href}>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </li>
              ))}
              <li aria-current="page">{s.title}</li>
            </ol>
          </nav>
        )}
        <h1>{s.title}</h1>
      </header>

      {tabs && <Tabs label={tabs.label} items={tabs.items} />}

      <section className={styles.card} aria-labelledby="placeholder-heading">
        <p className={styles.label} id="placeholder-heading">
          Not built yet · Phase {s.phase}
        </p>
        <p className={styles.does}>{s.does}</p>
        <dl className={styles.facts}>
          <div>
            <dt>Used by</dt>
            <dd>{s.usedBy}</dd>
          </div>
          <div>
            <dt>Spec</dt>
            <dd>{s.spec}</dd>
          </div>
          <div>
            <dt>Route</dt>
            <dd>
              <code>{s.route}</code>
            </dd>
          </div>
          {s.partOf && (
            <div>
              <dt>Part of</dt>
              <dd>{s.partOf}</dd>
            </div>
          )}
        </dl>
        {s.mockups.length > 0 ? (
          <ul className={styles.mockups}>
            {s.mockups.map((file) => (
              <li key={file}>
                <a href={mockupUrl(file)} target="_blank" rel="noreferrer">
                  View mock-up: {file.replace("reference/", "")}
                  <ExternalLink aria-hidden size={14} strokeWidth={1.75} />
                  <span className="visually-hidden">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>No mock-up for this screen; it follows the patterns in UI spec section 6.</p>
        )}
      </section>
    </div>
  );
}
