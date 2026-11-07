"use client";

/**
 * Reports from users, as a queue of cards:
 *
 *   [Reason] [Profile | Message]          reported 2 d ago by Sara
 *   (avatar) Zain Ahmed  zain@...  [3 open reports] [Suspended]
 *   "What the reporter wrote"
 *   > the reported message (message reports only)
 *   [View profile]                      [Dismiss] [Suspend] [Ban]
 *
 * "Open" shows what still needs a decision (newest first); "Closed" shows
 * what admins decided. Suspend and ban ask for a reason in the admin page
 * (the person sees it) and close EVERY open report about that person.
 */

import Link from "next/link";
import { ExternalLink, Flag, MessageSquare, UserRound } from "lucide-react";

import { Avatar, Badge, EmptyState, cx } from "@/app/components/ui";
import { ROUTES } from "@/app/config/routes";
import type { AdminReport, ReportAction } from "../types";
import styles from "../reports.module.css";
import filterStyles from "../users.module.css";

export type ReportsView = "open" | "closed";

type Props = {
  view: ReportsView;
  setView: (view: ReportsView) => void;
  openReports: AdminReport[];
  closedReports: AdminReport[] | null; // null = not loaded yet
  busyReportId: number | null;
  onResolve: (report: AdminReport, action: ReportAction) => void;
  formatDate: (value: string | null) => string;
};

/** "today", "1 day ago", "5 days ago". */
function ago(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** The serious reasons get a red badge; the rest amber. */
const SERIOUS = new Set<AdminReport["reason"]>(["scam", "harassment"]);

const ACTION_WORDS: Record<ReportAction, string> = {
  dismiss: "Dismissed",
  suspend: "Suspended",
  ban: "Banned",
};

function AccountBadge({ report }: { report: AdminReport }) {
  if (report.reportedUserDeleted) return <Badge tone="neutral">Deleted</Badge>;
  if (report.reportedUserAccountStatus === "banned") return <Badge tone="danger">Banned</Badge>;
  if (report.reportedUserAccountStatus === "suspended") return <Badge tone="warning">Suspended</Badge>;
  return null;
}

function ReportCard({
  report,
  busy,
  onResolve,
  formatDate,
}: {
  report: AdminReport;
  busy: boolean;
  onResolve: Props["onResolve"];
  formatDate: Props["formatDate"];
}) {
  const isOpen = report.status === "open";
  const status = report.reportedUserAccountStatus;
  // Same rules as ACCOUNT_ACTIONS in Django: suspend only active accounts, ban unless banned.
  const canSuspend = !report.reportedUserDeleted && status === "active";
  const canBan = !report.reportedUserDeleted && status !== "banned";
  const KindIcon = report.kind === "message" ? MessageSquare : UserRound;

  return (
    <li className={cx(styles.card, busy && styles.cardBusy)}>
      <div className={styles.top}>
        <div className={styles.tags}>
          <Badge tone={SERIOUS.has(report.reason) ? "danger" : "warning"}>{report.reasonLabel}</Badge>
          <span className={styles.kind}>
            <KindIcon size={14} aria-hidden="true" />
            {report.kind === "message" ? "Message" : "Profile"}
          </span>
        </div>
        <span className={styles.when}>
          Reported {ago(report.createdAt)} by {report.reporterName}
        </span>
      </div>

      <div className={styles.person}>
        <Avatar name={report.reportedUserName} size={40} />
        <div className={styles.personText}>
          <strong>{report.reportedUserName}</strong>
          <span>
            {report.reportedUserEmail} · {report.reportedUserRole === "recruiter" ? "Recruiter" : "Candidate"}
          </span>
        </div>
        <div className={styles.personBadges}>
          {isOpen && report.openReportsAboutUser > 1 && (
            <Badge tone="danger">{report.openReportsAboutUser} open reports</Badge>
          )}
          <AccountBadge report={report} />
        </div>
      </div>

      {report.details && (
        <p className={styles.details}>
          <span className={styles.label}>{report.reporterName.split(" ")[0]} wrote:</span> {report.details}
        </p>
      )}

      {report.kind === "message" && (
        <blockquote className={styles.message}>
          <span className={styles.label}>The reported message</span>
          {report.messageText || "(empty message)"}
        </blockquote>
      )}

      <div className={styles.bottom}>
        <Link
          href={ROUTES.USER_PROFILE(report.reportedUserId)}
          className={styles.profileLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          View profile
          <ExternalLink size={13} aria-hidden="true" />
        </Link>

        {isOpen ? (
          <div className={styles.actions}>
            {busy && <span className={styles.saving}>Saving...</span>}
            <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => onResolve(report, "dismiss")}>
              Dismiss
            </button>
            {canSuspend && (
              <button
                type="button"
                className="btn-danger-outline btn-sm"
                disabled={busy}
                onClick={() => onResolve(report, "suspend")}
              >
                Suspend
              </button>
            )}
            {canBan && (
              <button type="button" className="btn-danger-outline btn-sm" disabled={busy} onClick={() => onResolve(report, "ban")}>
                Ban
              </button>
            )}
          </div>
        ) : (
          <p className={styles.outcome}>
            <strong>{report.actionTaken ? ACTION_WORDS[report.actionTaken] : "Closed"}</strong>
            {report.resolvedByName && ` by ${report.resolvedByName}`}
            {report.resolvedAt && ` on ${formatDate(report.resolvedAt)}`}
            {report.resolutionNote && <span className={styles.note}>“{report.resolutionNote}”</span>}
          </p>
        )}
      </div>
    </li>
  );
}

export default function ReportsSection({
  view,
  setView,
  openReports,
  closedReports,
  busyReportId,
  onResolve,
  formatDate,
}: Props) {
  const list = view === "open" ? openReports : closedReports;

  return (
    <div className={styles.section}>
      <div className={filterStyles.filters} role="group" aria-label="Which reports">
        {(["open", "closed"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={cx(filterStyles.filter, view === option && filterStyles.filterOn)}
            aria-pressed={view === option}
            onClick={() => setView(option)}
          >
            {option === "open" ? "Open" : "Closed"}
            {option === "open" && <span className={filterStyles.filterCount}>{openReports.length}</span>}
          </button>
        ))}
      </div>

      {list === null ? (
        <p className="muted">Loading...</p>
      ) : list.length === 0 ? (
        <div className={filterStyles.panel}>
          <EmptyState
            icon={Flag}
            title={view === "open" ? "No open reports" : "No closed reports yet"}
            text={
              view === "open"
                ? "When someone reports a profile or a message, it shows up here."
                : "Reports you dismiss or act on are kept here."
            }
          />
        </div>
      ) : (
        <ol className={styles.list} aria-label={view === "open" ? "Open reports, newest first" : "Closed reports"}>
          {list.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              busy={busyReportId === report.id}
              onResolve={onResolve}
              formatDate={formatDate}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
