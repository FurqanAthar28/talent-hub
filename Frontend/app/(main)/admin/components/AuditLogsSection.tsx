import { History } from "lucide-react";

import { EmptyState, Panel, ui } from "@/app/components/ui";
import type { AdminAuditLog } from "../types";
import styles from "../admin.module.css";

type Props = {
  title: string;
  auditLogs: AdminAuditLog[];
  formatDate: (value: string | null) => string;
};

/** What admins changed, newest first: who did it, to whom, and when. */
export default function AuditLogsSection({ title, auditLogs, formatDate }: Props) {
  return (
    <Panel flush title={title}>
      {auditLogs.length === 0 ? (
        <EmptyState icon={History} title="Nothing recorded yet" text="Admin actions like approvals and role changes appear here." />
      ) : (
        <ul className={ui.list}>
          {auditLogs.map((log) => (
            <li key={log.id} className={styles.logRow}>
              <span>{log.description}</span>
              <span className={styles.logMeta}>
                By {log.actorName || log.actorEmail}
                {log.targetUserName ? `, for ${log.targetUserName}` : ""}
              </span>
              <time className={styles.logTime} dateTime={log.createdAt}>
                {formatDate(log.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
