import type { DashboardData } from "../../../services/dashboard";

type DashboardOverviewProps = {
  data: DashboardData;
};

export default function DashboardOverview({ data }: DashboardOverviewProps) {
  return (
    <section className="dashboard-grid">
      <article className="dashboard-card">
        <span className="card-label">Profile</span>
        <h2>{data.profileCompletion}% complete</h2>
        <p>
          {data.openToWork
            ? "You are currently open to work."
            : "Turn on Open to Work when you are ready."}
        </p>
      </article>

      <article className="dashboard-card">
        <span className="card-label">Skills</span>
        <h2>{data.skillsCount} skills</h2>
        <p>Keep your skills updated so recruiters can find you easily.</p>
      </article>

      <article className="dashboard-card">
        <span className="card-label">Portfolio</span>
        <h2>{data.projectsCount} projects</h2>
        <p>
          You have {data.experiencesCount} experience entries added to your
          profile.
        </p>
      </article>
    </section>
  );
}