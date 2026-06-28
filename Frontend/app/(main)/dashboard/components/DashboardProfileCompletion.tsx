import Link from "next/link";
import type { UiContent } from "../../../api/ui-content";
import type { DashboardUser } from "../../../../types/dashboard";

type DashboardProfileCompletionProps = {
  user: DashboardUser;
  uiContent: UiContent;
};

export default function DashboardProfileCompletion({
  user,
  uiContent,
}: DashboardProfileCompletionProps) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="text-center">
          <div className="font-semibold mb-1">
            {uiContent.profileCompletion}
          </div>

          <progress
            className="progress-bar"
            value={user.profileCompletion}
            max={100}
          />

          <div className="text-sm muted mt-1">
            {user.profileCompletion}% {uiContent.complete}
          </div>

          {user.missingFields.length > 0 && (
            <div className="mt-2 text-left">
              <p className="text-sm font-semibold mb-1">
                {uiContent.completeTheseNext}
              </p>

              <ul className="text-sm muted profile-missing-list">
                {user.missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          )}

          {user.profileCompletion < 100 && (
            <Link href={uiContent.routeProfileEdit} className="btn-outline btn-sm mt-2">
              {uiContent.completeProfile}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}