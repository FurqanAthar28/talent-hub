import type { Activity } from "@/app/services/dashboard";
import { formatRelativeTime } from "@/app/utils/time";
import styles from "../../dashboard.module.css";

/** "Recent activity": what I changed lately, newest first. */
export default function ActivityTimeline({ activities }: { activities: Activity[] }) {
  return (
    <section className={styles.panel} aria-labelledby="activity-title">
      <h2 id="activity-title" className={styles.panelTitle}>
        Recent activity
      </h2>

      {activities.length === 0 ? (
        <p className={styles.empty}>
          Changes you make, like adding a skill or a project, will show up here.
        </p>
      ) : (
        <ol className={styles.timeline}>
          {activities.map((activity) => (
            <li key={activity.id} className={styles.timelineItem}>
              <span className={styles.timelineTitle}>{activity.title}</span>
              {/* dateTime gives screen readers and search engines the exact date */}
              <time className={styles.timelineTime} dateTime={activity.created_at}>
                {formatRelativeTime(activity.created_at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
