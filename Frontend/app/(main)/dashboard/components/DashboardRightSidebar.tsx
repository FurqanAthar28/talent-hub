import type { UiContent } from "../../../api/ui-content";
import type { DashboardUser } from "../../../../types/dashboard";
import DashboardProfileCompletion from "./DashboardProfileCompletion";
import DashboardProfileLinks from "./DashboardProfileLinks";

type DashboardRightSidebarProps = {
  user: DashboardUser;
  uiContent: UiContent;
  cvUrl: string;
};

export default function DashboardRightSidebar({
  user,
  uiContent,
  cvUrl,
}: DashboardRightSidebarProps) {
  const isCandidate = user.role === "candidate";
  const isRecruiter = user.role === "recruiter";

  return (
    <aside>
      {isCandidate && (
        <>
          <DashboardProfileLinks
            user={user}
            uiContent={uiContent}
            cvUrl={cvUrl}
          />

          <DashboardProfileCompletion user={user} uiContent={uiContent} />
        </>
      )}

      {isRecruiter && user.companyWebsite && (
        <div className="card">
          <div className="card-header">
            <h3>{uiContent.companyWebsite}</h3>
          </div>

          <div className="card-body">
            <a
              href={user.companyWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="quick-link"
            >
              {uiContent.companyWebsite}
            </a>
          </div>
        </div>
      )}
    </aside>
  );
}