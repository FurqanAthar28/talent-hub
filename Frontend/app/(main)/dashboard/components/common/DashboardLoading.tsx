import styles from "../../dashboard.module.css";

/** Grey shapes where the dashboard will appear, so the page doesn't jump. */
export default function DashboardLoading() {
  return (
    <main className={styles.shell} aria-busy="true">
      <p className="sr-only">Loading your dashboard...</p>
      <div className={styles.placeholder} style={{ height: 56, maxWidth: 360 }} />
      <div className={styles.stack} style={{ marginTop: 24 }}>
        <div className={styles.placeholder} style={{ height: 180 }} />
        <div className={styles.placeholder} style={{ height: 96 }} />
      </div>
    </main>
  );
}
