import Link from "next/link";
import type { UiContent } from "../../../api/ui-content";
import type { DashboardUser } from "../../../../types/dashboard";

type DashboardProfileCardProps = {
  user: DashboardUser;
  uiContent: UiContent;
  userInitial: string;
  roleLabel: string;
  toggleSaving: boolean;
  toggleError: string;
  onOpenContactModal: () => void;
  onToggleOpenToWork: () => void;
};

export default function DashboardProfileCard({
  user,
  uiContent,
  userInitial,
  roleLabel,
  toggleSaving,
  toggleError,
  onOpenContactModal,
  onToggleOpenToWork,
}: DashboardProfileCardProps) {
  const isCandidate = user.role === "candidate";
  const isRecruiter = user.role === "recruiter";
  const isAdmin = user.role === "admin";

  return (
    <div className="card">
      <div className="profile-banner">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">{userInitial}</div>
        </div>
      </div>

      <div className="profile-info">
        <div className="profile-title-row">
          <div>
            <h1>{user.fullName}</h1>

            <p className="profile-headline">
              {user.headline || uiContent.addYourProfessionalHeadline}
            </p>
          </div>

          <div className="role-badge">{roleLabel}</div>
        </div>

        <div className="profile-meta">
          {user.location && <span>{user.location}</span>}

          <button
            type="button"
            onClick={onOpenContactModal}
            className="link-button"
          >
            {isCandidate
              ? uiContent.contactInfo
              : isRecruiter
                ? uiContent.companyContact
                : uiContent.adminInfo}
          </button>
        </div>

        {user.bio && <p className="mt-2">{user.bio}</p>}

        <div className="mt-2 flex gap-2 profile-actions-row">
          {isCandidate && (
            <button
              type="button"
              className={user.openToWork ? "btn-primary" : "btn-outline"}
              onClick={onToggleOpenToWork}
              disabled={toggleSaving}
            >
              {toggleSaving
                ? uiContent.adminUpdating
                : user.openToWork
                  ? uiContent.openToWork
                  : uiContent.setOpenToWork}
            </button>
          )}

          <Link href={uiContent.routeProfileEdit} className="btn-outline">
            {uiContent.editProfile}
          </Link>

          {isCandidate && (
            <Link href={uiContent.routeConnections} className="btn-outline">
              {uiContent.myNetwork}
            </Link>
          )}

          {isAdmin && (
            <Link href={uiContent.routeAdmin} className="btn-outline">
              {uiContent.adminDashboard}
            </Link>
          )}
        </div>

        {toggleError && (
          <p className="form-error text-sm mt-1">{toggleError}</p>
        )}
      </div>
    </div>
  );
}