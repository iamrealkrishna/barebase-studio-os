import { BottomBar } from "./BottomBar";
import styles from "./shell.module.css";
import { TopBar } from "./TopBar";

/**
 * The frame every staff page sits in: dark sidebar, slim top bar, the page
 * (UI spec 3). The sidebar is either the global one or a project's.
 */
export function AppShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={styles.app}>
      {sidebar}
      <div className={styles.column}>
        <TopBar />
        <main className={styles.main} id="main">
          {children}
        </main>
      </div>
      <BottomBar />
    </div>
  );
}
