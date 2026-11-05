"use client";

import { Users } from "lucide-react";

import { Avatar, Badge, EmptyState, ui } from "@/app/components/ui";
import type { AdminUser } from "../types";
import styles from "../admin.module.css";

type TextFn = (key: string, fallback: string) => string;

type Props = {
  text: TextFn;
  users: AdminUser[];
  totalCount: number;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  busyUserId: number | null; // the user whose action is running
  onToggleActive: (user: AdminUser) => void;
  onChangeRole: (user: AdminUser, role: AdminUser["role"]) => void;
  onVerify: (user: AdminUser, status: "approved" | "rejected") => void;
  formatDate: (value: string | null) => string;
};

/** "Approved" in green, "Pending" in amber, "Rejected" in red. */
export function VerificationBadge({ user, text }: { user: AdminUser; text: TextFn }) {
  if (user.role !== "recruiter") return null;
  if (user.recruiterVerificationStatus === "approved") {
    return <Badge tone="success">{text("adminRecruiterApproved", "Approved")}</Badge>;
  }
  if (user.recruiterVerificationStatus === "rejected") {
    return <Badge tone="danger">{text("adminRecruiterRejected", "Rejected")}</Badge>;
  }
  return <Badge tone="warning">{text("adminRecruiterPending", "Waiting for approval")}</Badge>;
}

/** Every account, with role, status and actions. */
export default function UsersSection({
  text,
  users,
  totalCount,
  searchTerm,
  setSearchTerm,
  busyUserId,
  onToggleActive,
  onChangeRole,
  onVerify,
  formatDate,
}: Props) {
  return (
    <section className={`${ui.panel} ${ui.panelFlush}`} aria-label="Users">
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={text("adminSearchPlaceholder", "Search by name or email")}
          aria-label="Search users"
        />
        <span className={styles.count}>
          {users.length === totalCount ? `${totalCount} users` : `${users.length} of ${totalCount} users`}
        </span>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={Users} title={text("adminNoUsers", "No users found")} text="Try another name or email." />
      ) : (
        <ul className={ui.list}>
          {users.map((user) => {
            const busy = busyUserId === user.id;
            return (
              <li key={user.id} className={styles.userRow}>
                <div className={styles.userWho}>
                  <Avatar name={user.fullName || user.email} size={40} />
                  <div className={ui.rowMain}>
                    <span className={ui.rowTitle}>{user.fullName || "(no name)"}</span>
                    <span className={ui.rowText}>{user.email}</span>
                    <div className={styles.badges}>
                      {user.is_active ? (
                        <Badge tone="success">{text("adminActive", "Active")}</Badge>
                      ) : (
                        <Badge tone="neutral">{text("adminInactive", "Switched off")}</Badge>
                      )}
                      <VerificationBadge user={user} text={text} />
                    </div>
                  </div>
                </div>

                <div>
                  <span className={styles.cellLabel}>{text("adminRole", "Role")}</span>
                  {/* Changing the role asks first (see onChangeRole in page.tsx). */}
                  <select
                    className={styles.select}
                    value={user.role}
                    onChange={(event) => onChangeRole(user, event.target.value as AdminUser["role"])}
                    disabled={busy}
                    aria-label={`Role of ${user.fullName || user.email}`}
                  >
                    <option value="candidate">Candidate</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className={styles.cellValue}>
                  <span className={styles.cellLabel}>
                    {text("adminJoined", "Joined")} {formatDate(user.date_joined)}
                  </span>
                  <span className={styles.cellLabel}>
                    {text("adminLastLogin", "Last seen")} {user.last_login ? formatDate(user.last_login) : "never"}
                  </span>
                  <span className={styles.cellLabel}>
                    {text("adminProfileCompletion", "Profile")} {user.profileCompletion}% complete
                  </span>
                </div>

                <div className={styles.rowButtons}>
                  {user.role === "recruiter" && user.recruiterVerificationStatus !== "approved" && (
                    <button type="button" className="btn-primary btn-sm" onClick={() => onVerify(user, "approved")} disabled={busy}>
                      {text("adminApproveRecruiter", "Approve")}
                    </button>
                  )}
                  {user.role === "recruiter" && user.recruiterVerificationStatus !== "rejected" && (
                    <button type="button" className="btn-outline btn-sm" onClick={() => onVerify(user, "rejected")} disabled={busy}>
                      {text("adminRejectRecruiter", "Reject")}
                    </button>
                  )}
                  <button
                    type="button"
                    className={user.is_active ? "btn-danger-outline btn-sm" : "btn-outline btn-sm"}
                    disabled={busy}
                    onClick={() => onToggleActive(user)}
                  >
                    {busy
                      ? text("adminUpdating", "Saving...")
                      : user.is_active
                        ? text("adminDeactivate", "Switch off")
                        : text("adminActivate", "Switch on")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
