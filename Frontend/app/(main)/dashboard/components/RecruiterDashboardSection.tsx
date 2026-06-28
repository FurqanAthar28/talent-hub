export default function RecruiterDashboardSection() {
  return (
    <section className="dashboard-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Recruiter</p>
          <h2>Recruiter workspace</h2>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <span className="card-label">Candidates</span>
          <h3>Search professionals</h3>
          <p>Find candidates by skills, location, and profile details.</p>
        </article>

        <article className="dashboard-card">
          <span className="card-label">Shortlist</span>
          <h3>Review saved profiles</h3>
          <p>Keep track of strong candidates for future hiring needs.</p>
        </article>
      </div>
    </section>
  );
}