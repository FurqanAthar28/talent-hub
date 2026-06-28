export default function DashboardOverview() {
  return (
    <section className="dashboard-grid">
      <article className="dashboard-card">
        <span className="card-label">Profile</span>
        <h2>Profile strength</h2>
        <p>Keep your skills, projects, and experience updated.</p>
      </article>

      <article className="dashboard-card">
        <span className="card-label">Connections</span>
        <h2>Network activity</h2>
        <p>Review connection requests and grow your professional network.</p>
      </article>

      <article className="dashboard-card">
        <span className="card-label">Opportunities</span>
        <h2>Career visibility</h2>
        <p>Recruiters can discover your profile based on your skills.</p>
      </article>
    </section>
  );
}