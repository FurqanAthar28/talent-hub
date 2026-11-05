"use client";

/**
 * The approval queue: everyone waiting, oldest first (first come, first served).
 * "Review" opens the review window (ApprovalReview), which runs the checks
 * and lets the admin approve or turn the person down.
 */

import { UserCheck } from "lucide-react";

import { Avatar, Badge, EmptyState } from "@/app/components/ui";
import { displayName } from "@/app/services/admin";
import type { AdminUser } from "../types";
import styles from "../users.module.css";

type Props = {
  waiting: AdminUser[];
  onReview: (user: AdminUser) => void;
  formatDate: (value: string | null) => string;
};

/** Whole days since `value` ("today", "1 day", "5 days"). */
function waitedFor(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000));
  return days <= 0 ? "since today" : `for ${days} ${days === 1 ? "day" : "days"}`;
}

export default function ApprovalsSection({ waiting, onReview, formatDate }: Props) {
  if (waiting.length === 0) {
    return (
      <div className={styles.panel}>
        <EmptyState icon={UserCheck} title="Nobody is waiting" text="New candidates and recruiters appear here as soon as they confirm their email." />
      </div>
    );
  }

  const oldestFirst = [...waiting].sort((a, b) => a.date_joined.localeCompare(b.date_joined));

  return (
    <ol className={styles.queue} aria-label="Waiting for approval, oldest first">
      {oldestFirst.map((user) => (
        <li key={user.id} className={styles.queueItem}>
          <Avatar name={displayName(user)} size={48} />
          <div>
            <div className={styles.badges}>
              <strong>{displayName(user)}</strong>
              <Badge tone="neutral">{user.role === "recruiter" ? "Recruiter" : "Candidate"}</Badge>
            </div>
            <div className={styles.queueMeta}>
              <span>{user.email}</span>
              <span>
                Joined {formatDate(user.date_joined)}, waiting {waitedFor(user.date_joined)}
              </span>
              <span>Profile {user.profileCompletion}% complete</span>
            </div>
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={() => onReview(user)}>
            Review
          </button>
        </li>
      ))}
    </ol>
  );
}
