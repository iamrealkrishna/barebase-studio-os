import styles from "./auth.module.css";

/** Sign-in frame: dark brand panel on the left, the form on paper on the right (screens Login.png). */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.auth}>
      <aside className={styles.panel}>
        <p className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            B
          </span>
          Barebase Platform
        </p>
        <div>
          <p className={styles.tagline}>Every lead, BOQ, rupee and snag in one place.</p>
          <p className={styles.note}>
            For the Barebase team. Clients sign in from the link in their WhatsApp or email and see only their own
            home.
          </p>
        </div>
        <p className={styles.footer}>Barebase · Kanchan Integrated Property Development Co. · Bengaluru</p>
      </aside>
      <main className={styles.form}>{children}</main>
    </div>
  );
}
