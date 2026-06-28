import type { UiContent } from "../../../api/ui-content";
import type { DashboardActivity as DashboardActivityType } from "../../../../types/dashboard";
import { formatRelativeTime } from "../Utils";

type DashboardActivityProps = {
  activities: DashboardActivityType[];
  uiContent: UiContent;
};

export default function DashboardActivity({
  activities,
  uiContent,
}: DashboardActivityProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{uiContent.activity}</h3>
      </div>

      <div className="card-body">
        {activities.length > 0 ? (
          <div className="activity-list">
            {activities.map((activity) => (
              <div key={activity.id} className="mb-2 text-sm">
                <div className="font-semibold">{activity.title}</div>
                <div className="text-xs muted">
                  {formatRelativeTime(activity.created_at)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center muted text-sm">{uiContent.emptyActivity}</p>
        )}
      </div>
    </div>
  );
}