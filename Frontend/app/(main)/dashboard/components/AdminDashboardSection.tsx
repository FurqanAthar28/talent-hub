export default function AdminDashboardSection() {
  return (
    <section className="dashboard-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Platform overview</h2>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <span className="card-label">Users</span>
          <h3>User management</h3>
          <p>Monitor registered users and platform activity.</p>
        </article>

        <article className="dashboard-card">
          <span className="card-label">Reports</span>
          <h3>Platform reports</h3>
          <p>Review profile activity, connections, and system usage.</p>
        </article>
      </div>
    </section>
  );
}