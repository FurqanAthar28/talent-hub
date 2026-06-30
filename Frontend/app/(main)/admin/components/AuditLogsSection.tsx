import type { UiContent } from "../../../api/ui-content";
import type { AdminAuditLog } from "../types";

type Props = {
  uiContent: UiContent;
  auditLogs: AdminAuditLog[];
  formatDate: (value: string | null) => string;
};

export default function AuditLogsSection({
  uiContent,
  auditLogs,
  formatDate,
}: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{uiContent.adminAuditLogs}</h3>
        <p className="muted text-sm">
          {uiContent.adminAuditLogsIntro}
        </p>
      </div>

      <div className="card-body">
        {auditLogs.length === 0 ? (
          <p className="text-center muted">
            {uiContent.adminNoAuditLogs}
          </p>
        ) : (
          <div className="admin-audit-list">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="admin-audit-row"
              >
                <div>
                  <div className="text-sm muted">
                    {uiContent.adminAuditAction}
                  </div>

                  <div className="font-semibold">
                    {log.description}
                  </div>

                  <div className="text-xs muted">
                    {log.action}
                  </div>
                </div>

                <div>
                  <div className="text-sm muted">
                    {uiContent.adminAuditActor}
                  </div>

                  <div>{log.actorName}</div>

                  <div className="text-xs muted">
                    {log.actorEmail}
                  </div>
                </div>

                <div>
                  <div className="text-sm muted">
                    {uiContent.adminAuditTarget}
                  </div>

                  <div>{log.targetUserName || "-"}</div>

                  <div className="text-xs muted">
                    {log.targetUserEmail}
                  </div>
                </div>

                <div>
                  <div className="text-sm muted">
                    {uiContent.adminAuditTime}
                  </div>

                  <div>
                    {formatDate(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}