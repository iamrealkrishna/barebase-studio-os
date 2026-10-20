import Link from "next/link";

import { Tabs } from "@/components/ui/Tabs";
import type { Tab } from "@/lib/nav";
import { mockupSrc, screen, type ScreenKey } from "@/lib/screens";

import styles from "./Placeholder.module.css";

type PlaceholderProps = {
  screenKey: ScreenKey;
  /** Inside a project: its id and name, for the breadcrumb. */
  project?: { id: string; name: string };
  /** Section tabs shown above the content (Finance, BOQ, Home budget and so on). */
  tabs?: { label: string; items: Tab[] };
  /** Breadcrumb trail ahead of the title, outside a project. */
  breadcrumb?: { label: string; href: string }[];
  /** Working features that already cover part of this screen, linked so nothing is a dead end. */
  workingToday?: { label: string; href: string }[];
};

/**
 * Stand-in for a screen that isn't built yet. Shows its title in the right shell,
 * what it will do, who it's for, its spec sections and its mock-up, so the whole
 * product can be clicked through from sign-in (prompts/00-kickoff.md, step 3).
 */
export function Placeholder({ screenKey, project, tabs, breadcrumb, workingToday }: PlaceholderProps) {
  const s = screen(screenKey);
  const trail =
    breadcrumb ??
    (project
      ? [
          { label: "Projects", href: "/projects" },
          { label: project.name, href: `/projects/${project.id}` },
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
          {s.partOf && (
            <div>
              <dt>Part of</dt>
              <dd>{s.partOf}</dd>
            </div>
          )}
        </dl>
        {workingToday && workingToday.length > 0 && (
          <div className={styles.working}>
            <p className={styles.label}>Working today</p>
            <ul>
              {workingToday.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {s.mockups.map((file) => (
        <figure key={file} className={styles.mockup}>
          {/* Mock-ups are design references in docs/, served to signed-in staff by /mockups/[...file]. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mockupSrc(file)} alt={`Mock-up of ${s.title} (${file.replace("reference/", "")})`} loading="lazy" />
          <figcaption>Mock-up: docs/ui/{file.startsWith("reference/") ? file : `screens/${file}`}</figcaption>
        </figure>
      ))}
    </div>
  );
}
