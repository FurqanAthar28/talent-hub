import Link from "next/link";
import type { UiContent } from "../../../api/ui-content";
import type { DashboardUser } from "../../../../types/dashboard";

type DashboardProfileLinksProps = {
  user: DashboardUser;
  uiContent: UiContent;
  cvUrl: string;
};

export default function DashboardProfileLinks({
  user,
  uiContent,
  cvUrl,
}: DashboardProfileLinksProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{uiContent.professionalProfiles}</h3>
      </div>

      <div className="card-body">
        {user.linkedinUrl ? (
          <a
            href={user.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link"
          >
            {uiContent.linkedin}
          </a>
        ) : (
          <Link href={uiContent.routeProfileEdit} className="quick-link">
            {uiContent.addLinkedin}
          </Link>
        )}

        {user.githubUrl ? (
          <a
            href={user.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link"
          >
            {uiContent.github}
          </a>
        ) : (
          <Link href={uiContent.routeProfileEdit} className="quick-link">
            {uiContent.addGithub}
          </Link>
        )}

        {user.portfolioUrl ? (
          <a
            href={user.portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link"
          >
            {uiContent.portfolio}
          </a>
        ) : (
          <Link href={uiContent.routeProfileEdit} className="quick-link">
            {uiContent.addPortfolio}
          </Link>
        )}

        {user.cvUrl ? (
          <a
            href={cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link"
          >
            {uiContent.viewCv}
          </a>
        ) : (
          <Link href={uiContent.routeProfileEdit} className="quick-link">
            {uiContent.uploadCv}
          </Link>
        )}
      </div>
    </div>
  );
}