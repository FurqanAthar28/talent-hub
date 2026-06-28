import Link from "next/link";
import type { UiContent } from "../../../api/ui-content";
import type { DashboardUser } from "../../../../types/dashboard";

type DashboardSidebarProps = {
  user: DashboardUser;
  uiContent: UiContent;
};

export default function DashboardSidebar({
  user,
  uiContent,
}: DashboardSidebarProps) {
  const isCandidate = user.role === "candidate";
  const isRecruiter = user.role === "recruiter";
  const isAdmin = user.role === "admin";

  const userInitial =
    user.fullName?.charAt(0).toUpperCase() || uiContent.avatarFallbackInitial;

  const roleLabel = isAdmin
    ? uiContent.adminProfile
    : isRecruiter
      ? uiContent.recruiterProfile
      : uiContent.candidateProfile;

  return (
    <aside>
      <div className="card">
        <div className="profile-banner-sm">
          <div className="profile-avatar-wrap-center">
            <div className="profile-avatar-sm">{userInitial}</div>
          </div>
        </div>

        <div className="card-body text-center profile-sidebar-body">
          <h3>{user.fullName}</h3>

          <p className="text-sm muted">
            {user.headline || uiContent.addProfessionalHeadline}
          </p>

          <div className="role-badge">{roleLabel}</div>
        </div>

        <div className="divider"></div>

        <div className="card-body text-sm">
          {isCandidate && (
            <>
              <div className="flex-between mb-2">
                <span className="muted">{uiContent.profileViewers}</span>
                <span className="font-semibold">{user.profileViewers}</span>
              </div>

              <Link
                href={uiContent.routeConnections}
                className="flex-between mb-2"
              >
                <span className="muted">{uiContent.connections}</span>
                <span className="font-semibold">{user.connectionsCount}</span>
              </Link>
            </>
          )}

          {isRecruiter && (
            <>
              <div className="flex-between mb-2">
                <span className="muted">{uiContent.companyName}</span>
                <span className="font-semibold">
                  {user.companyName || uiContent.notAdded}
                </span>
              </div>

              <div className="flex-between mb-2">
                <span className="muted">{uiContent.hiringTitle}</span>
                <span className="font-semibold">
                  {user.hiringTitle || uiContent.notAdded}
                </span>
              </div>
            </>
          )}

          {isAdmin && (
            <div className="flex-between mb-2">
              <span className="muted">{uiContent.adminTitle}</span>
              <span className="font-semibold">
                {user.adminTitle || uiContent.adminTitlePlaceholder}
              </span>
            </div>
          )}

          <div className="flex-between mb-2">
            <span className="muted">{uiContent.adminStatus}</span>

            <span className="font-semibold">
              {isCandidate
                ? user.openToWork
                  ? uiContent.openToWork
                  : uiContent.notLooking
                : isRecruiter
                  ? user.companyName || uiContent.recruiter
                  : user.adminTitle || uiContent.adminRole}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}