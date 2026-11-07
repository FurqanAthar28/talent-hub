import { Panel } from "@/app/components/ui";
import type { AdminStats } from "../types";
import styles from "../admin.module.css";

type TextFn = (key: string, fallback: string) => string;

/** The platform numbers, in 3 labelled groups. Every number has a label. */
export default function StatsSection({ stats, text }: { stats: AdminStats; text: TextFn }) {
  const groups = [
    {
      title: "People",
      items: [
        { label: text("adminUsers", "All users"), value: stats.users },
        { label: text("adminActiveUsers", "Active"), value: stats.activeUsers },
        { label: text("adminInactiveUsers", "Can't sign in"), value: stats.inactiveUsers },
        { label: text("adminSuspendedUsers", "Suspended"), value: stats.suspendedUsers },
        { label: text("adminBannedUsers", "Banned"), value: stats.bannedUsers },
        { label: text("adminDeletedUsers", "Deleted (restorable)"), value: stats.deletedUsers },
        { label: text("adminStaffUsers", "Admins"), value: stats.adminUsers },
      ],
    },
    {
      title: "Roles",
      items: [
        { label: "Candidates", value: stats.candidates },
        { label: "Recruiters", value: stats.recruiters },
        {
          label: "Waiting for approval",
          value: stats.pendingApprovals,
          warning: stats.pendingApprovals > 0,
        },
        {
          label: "Open reports",
          value: stats.openReports,
          warning: stats.openReports > 0,
        },
      ],
    },
    {
      title: "Activity",
      items: [
        { label: "Connections", value: stats.connections },
        { label: text("adminPendingRequests", "Open connection requests"), value: stats.pendingConnectionRequests },
        { label: text("adminSkills", "Skills added"), value: stats.skills },
        { label: text("adminProjects", "Projects added"), value: stats.projects },
        { label: text("adminExperiences", "Work experiences added"), value: stats.experiences },
      ],
    },
  ];

  return (
    <div className={styles.statGroups}>
      {groups.map((group) => (
        <Panel key={group.title} title={group.title}>
          <ul className={styles.statList}>
            {group.items.map((item) => (
              <li key={item.label} className={styles.stat}>
                <span className={styles.statLabel}>{item.label}</span>
                <span className={`${styles.statValue} ${"warning" in item && item.warning ? styles.statValueWarning : ""}`}>
                  {/* "—" instead of crashing the page if the server didn't send this number. */}
                  {typeof item.value === "number" ? item.value.toLocaleString() : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}
