import type { UiContent } from "../../../api/ui-content";
import type { DashboardUser } from "../../../../types/dashboard";

type DashboardContactModalProps = {
  user: DashboardUser;
  uiContent: UiContent;
  onClose: () => void;
};

export default function DashboardContactModal({
  user,
  uiContent,
  onClose,
}: DashboardContactModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{uiContent.contactInfo}</h3>

          <button type="button" className="modal-close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="modal-body">
          <div className="contact-item">
            <span className="contact-label">{uiContent.email}</span>
            <a href={`mailto:${user.email}`} className="contact-value">
              {user.email}
            </a>
          </div>

          {user.linkedinUrl && (
            <div className="contact-item">
              <span className="contact-label">{uiContent.linkedin}</span>
              <a
                href={user.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-value"
              >
                {user.linkedinUrl.replace("https://", "")}
              </a>
            </div>
          )}

          {user.githubUrl && (
            <div className="contact-item">
              <span className="contact-label">{uiContent.github}</span>
              <a
                href={user.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-value"
              >
                {user.githubUrl.replace("https://", "")}
              </a>
            </div>
          )}

          {user.portfolioUrl && (
            <div className="contact-item">
              <span className="contact-label">{uiContent.portfolio}</span>
              <a
                href={user.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-value"
              >
                {user.portfolioUrl.replace("https://", "")}
              </a>
            </div>
          )}

          {user.location && (
            <div className="contact-item">
              <span className="contact-label">{uiContent.location}</span>
              <span className="contact-value">{user.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}