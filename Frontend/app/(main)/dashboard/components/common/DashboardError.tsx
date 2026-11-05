import styles from "../../dashboard.module.css";

/** Shown when the dashboard can't load. Says what happened and what to do. */
export default function DashboardError({ message }: { message: string }) {
  return (
    <main className={styles.shell}>
      <section className={styles.panel} role="alert">
        <h1 className={styles.panelTitle}>Your dashboard didn&apos;t load</h1>
        <p className={styles.panelHint}>{message}</p>
        <p className={styles.panelHint}>Check your connection, then refresh the page.</p>
      </section>
    </main>
  );
}
