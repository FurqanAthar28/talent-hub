import type { UiContent } from "../../../api/ui-content";
import type { AdminStats } from "../types";

type Props = {
  stats: AdminStats;
  uiContent: UiContent;
};

export default function StatsSection({
  stats,
  uiContent,
}: Props) {
  return (
    <>
      <div className="dashboard-stats">
        <div className="dashboard-stat-card">
          <h3>{stats.users}</h3>
          <p>{uiContent.adminUsers}</p>
        </div>

        <div className="dashboard-stat-card">
          <h3>{stats.activeUsers}</h3>
          <p>{uiContent.adminActiveUsers}</p>
        </div>

        <div className="dashboard-stat-card">
          <h3>{stats.inactiveUsers}</h3>
          <p>{uiContent.adminInactiveUsers}</p>
        </div>

        <div className="dashboard-stat-card">
          <h3>{stats.pendingConnectionRequests}</h3>
          <p>{uiContent.adminPendingRequests}</p>
        </div>

        <div className="dashboard-stat-card">
          <h3>{stats.pendingRecruiters}</h3>
          <p>{uiContent.adminPendingRecruiters}</p>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat-card">
          <h3>{stats.staffUsers}</h3>
          <p>{uiContent.adminStaffUsers}</p>
        </div>

        <div className="dashboard-stat-card">
          <h3>{stats.skills}</h3>
          <p>{uiContent.adminSkills}</p>
        </div>

        <div className="dashboard-stat-card">
          <h3>{stats.projects}</h3>
          <p>{uiContent.adminProjects}</p>
        </div>

        <div className="dashboard-stat-card">
          <h3>{stats.experiences}</h3>
          <p>{uiContent.adminExperiences}</p>
        </div>
      </div>
    </>
  );
}