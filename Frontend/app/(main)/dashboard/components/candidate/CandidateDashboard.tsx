import type { DashboardData } from "@/app/services/dashboard";
import Link from "next/link";

type CandidateDashboardProps = {
  data: DashboardData;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function CandidateDashboard({
  data,
}: CandidateDashboardProps) {
  const completedSections = [
    data.skillsCount > 0,
    data.projectsCount > 0,
    data.experiencesCount > 0,
  ].filter(Boolean).length;

  return (
    <div className="dashboard-linkedin-layout dashboard-home-layout">
      <aside className="dashboard-profile-panel">
        <div className="dashboard-profile-cover" />
        <div className="dashboard-profile-body">
          <div className="dashboard-avatar">{getInitials(data.fullName)}</div>
          <h2>{data.fullName}</h2>
          <p>{data.headline}</p>
          <span className={data.openToWork ? "status-badge status-success" : "status-badge status-muted"}>
            {data.openToWork ? "Open to work" : "Not actively looking"}
          </span>
        </div>

        <div className="dashboard-panel-list">
          <div>
            <span>Profile strength</span>
            <strong>{data.profileCompletion}%</strong>
          </div>
          <div>
            <span>Portfolio sections</span>
            <strong>{completedSections}/3</strong>
          </div>
        </div>
      </aside>

      <section className="dashboard-main-column">
        <article className="dashboard-work-card">
          <div className="dashboard-work-header">
            <div>
              <p className="eyebrow">Profile readiness</p>
              <h2>Make your profile easier to discover</h2>
            </div>
            <strong>{data.profileCompletion}%</strong>
          </div>

          <progress className="progress-bar" value={data.profileCompletion} max={100} />

          <div className="dashboard-checklist">
            <Link href="/profile/edit#skills" className={data.skillsCount > 0 ? "done" : ""}>
              <span>Skills</span>
              <strong>{data.skillsCount}</strong>
            </Link>
            <Link href="/profile/edit#projects" className={data.projectsCount > 0 ? "done" : ""}>
              <span>Projects</span>
              <strong>{data.projectsCount}</strong>
            </Link>
            <Link href="/profile/edit#experience" className={data.experiencesCount > 0 ? "done" : ""}>
              <span>Experience</span>
              <strong>{data.experiencesCount}</strong>
            </Link>
          </div>
        </article>

        <section className="dashboard-section dashboard-signal-section">
          <div className="section-header dashboard-section-header">
            <div>
              <p className="eyebrow">Visibility</p>
              <h2>Profile signals</h2>
            </div>
          </div>

          <div className="dashboard-signal-grid">
            <div>
              <span>Skills</span>
              <strong>{data.skillsCount}</strong>
            </div>
            <div>
              <span>Projects</span>
              <strong>{data.projectsCount}</strong>
            </div>
            <div>
              <span>Experience</span>
              <strong>{data.experiencesCount}</strong>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-header dashboard-section-header">
            <div>
              <p className="eyebrow">Next steps</p>
              <h2>Keep your professional presence active</h2>
            </div>
          </div>

          <div className="dashboard-action-list">
            <Link href="/profile/edit#information" className="dashboard-action-row">
              <span>Update profile headline and location</span>
              <strong>Improve profile</strong>
            </Link>
            <Link href="/profile/edit#resume" className="dashboard-action-row">
              <span>Upload or replace your latest resume</span>
              <strong>Manage resume</strong>
            </Link>
            <Link href="/connections" className="dashboard-action-row">
              <span>Find professionals and recruiters to connect with</span>
              <strong>Grow network</strong>
            </Link>
            <Link href="/messages" className="dashboard-action-row">
              <span>Continue your professional conversations</span>
              <strong>Open inbox</strong>
            </Link>
          </div>
        </section>
      </section>
    </div>
  );
}
