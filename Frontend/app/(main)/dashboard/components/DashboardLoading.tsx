export default function DashboardLoading() {
  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Loading...</h1>
          <p>Please wait while we load your dashboard.</p>
        </div>
      </section>

      <section className="dashboard-grid">
        {[1, 2, 3].map((item) => (
          <article key={item} className="dashboard-card">
            <h3>Loading...</h3>
            <p>Loading dashboard information...</p>
          </article>
        ))}
      </section>
    </main>
  );
}