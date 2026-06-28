import type { UiContent } from "../../../api/ui-content";
import type { DashboardUser } from "../../../../types/dashboard";

type DashboardStatsProps = {
  user: DashboardUser;
  uiContent: UiContent;
};

export default function DashboardStats({ user, uiContent }: DashboardStatsProps) {
  const isCandidate = user.role === "candidate";
  const isRecruiter = user.role === "recruiter";
  const isAdmin = user.role === "admin";

  return (
    <div className="dashboard-stats">
      {isCandidate && (
        <>
          <div className="dashboard-stat-card">
            <h3>{user.connectionsCount}</h3>
            <p>{uiContent.connections}</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>{user.projectsCount}</h3>
            <p>{uiContent.projects}</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>{user.skillsCount}</h3>
            <p>{uiContent.skills}</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>{user.profileCompletion}%</h3>
            <p>{uiContent.profileCompletion}</p>
          </div>
        </>
      )}

      {isRecruiter && (
        <>
          <div className="dashboard-stat-card">
            <h3>{user.companyName || uiContent.notAdded}</h3>
            <p>{uiContent.companyName}</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>{user.hiringTitle || uiContent.notAdded}</h3>
            <p>{uiContent.hiringTitle}</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>{user.companyLocation || uiContent.notAdded}</h3>
            <p>{uiContent.companyLocation}</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>{user.profileCompletion}%</h3>
            <p>{uiContent.recruiterProfile}</p>
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <div className="dashboard-stat-card">
            <h3>{user.adminTitle || uiContent.adminRole}</h3>
            <p>{uiContent.role}</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>{uiContent.adminUsers}</h3>
            <p>{uiContent.moderation}</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>{uiContent.access}</h3>
            <p>{uiContent.staffControls}</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>{user.profileCompletion}%</h3>
            <p>{uiContent.adminProfile}</p>
          </div>
        </>
      )}
    </div>
  );
}