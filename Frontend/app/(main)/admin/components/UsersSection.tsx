"use client";

/**
 * Every account, as a table:
 *   Person | Role | Status | Joined | Last sign-in | [Review] [⋯]
 *
 * On phones each row becomes a small card (same content, stacked).
 * The "⋯" menu holds everything you can do to that account, and only what
 * makes sense right now (e.g. "Lift ban" only for banned people). Every
 * choice opens an "are you sure?" box first (in the admin page).
 */

import { Search, Users } from "lucide-react";

import { Avatar, Badge, EmptyState, cx } from "@/app/components/ui";
import {
  accountState,
  allowedAccountActions,
  daysLeft,
  displayName,
  isWaitingForApproval,
  type AccountAction,
} from "@/app/services/admin";
import { ACCOUNT_ACTION_TEXT, USER_FILTERS, type UserFilter } from "../accountActions";
import type { AdminUser } from "../types";
import styles from "../users.module.css";
import RowMenu, { type MenuItem } from "./RowMenu";

type TextFn = (key: string, fallback: string) => string;
type Role = AdminUser["role"];

const ROLE_LABEL: Record<Role, string> = { candidate: "Candidate", recruiter: "Recruiter", admin: "Admin" };
const ROLES = Object.keys(ROLE_LABEL) as Role[];

type Props = {
  text: TextFn;
  users: AdminUser[]; // already searched and filtered
  totalCount: number;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filter: UserFilter;
  setFilter: (value: UserFilter) => void;
  filterCounts: Record<UserFilter, number>;
  myId: number; // the signed-in admin: no actions on yourself (Django refuses them too)
  busyUserId: number | null; // the user whose action is running
  onAccountAction: (user: AdminUser, action: AccountAction) => void;
  onChangeRole: (user: AdminUser, role: Role) => void;
  onReview: (user: AdminUser) => void;
  formatDate: (value: string | null) => string;
};

/**
 * Only shown when it's NOT approved: "Active" already says all is well, and
 * "Active, Approved" on every row was noise. (Admins aren't reviewed.)
 */
export function ApprovalBadge({ user, text }: { user: AdminUser; text: TextFn }) {
  if (user.role === "admin" || user.approvalStatus === "approved") return null;
  if (user.approvalStatus === "rejected") {
    return <Badge tone="danger">{text("adminRecruiterRejected", "Not approved")}</Badge>;
  }
  return <Badge tone="warning">{text("adminRecruiterPending", "Waiting for approval")}</Badge>;
}

/** Where the account stands: one label, plus the countdown for deleted accounts. */
export function AccountBadge({ user, text }: { user: AdminUser; text: TextFn }) {
  switch (accountState(user)) {
    case "deleted": {
      const days = daysLeft(user.restoreUntil);
      return (
        <Badge tone="danger">
          {text("adminDeleted", "Deleted")}, {days === 0 ? "time is up" : days === 1 ? "last day" : `${days} days left`}
        </Badge>
      );
    }
    case "banned":
      return <Badge tone="danger">{text("adminBanned", "Banned")}</Badge>;
    case "suspended":
      return <Badge tone="warning">{text("adminSuspended", "Suspended")}</Badge>;
    case "unverified":
      return <Badge tone="neutral">{text("adminUnverified", "Email not confirmed")}</Badge>;
    default:
      return <Badge tone="success">{text("adminActive", "Active")}</Badge>;
  }
}

/** A short line under the email: why it's suspended / banned / deleted. */
function statusNote(user: AdminUser): string {
  const state = accountState(user);
  if (state === "deleted") {
    const who = user.deletedByAdmin ? "Deleted by an admin" : "Deleted by the person";
    return user.deletedByAdmin && user.statusReason ? `${who}: ${user.statusReason}` : who;
  }
  if ((state === "suspended" || state === "banned") && user.statusReason) return `Reason: ${user.statusReason}`;
  return "";
}

export default function UsersSection({
  text,
  users,
  totalCount,
  searchTerm,
  setSearchTerm,
  filter,
  setFilter,
  filterCounts,
  myId,
  busyUserId,
  onAccountAction,
  onChangeRole,
  onReview,
  formatDate,
}: Props) {
  /** What the "⋯" menu offers for this person. */
  function menuFor(user: AdminUser, deleted: boolean): MenuItem[] {
    const items: MenuItem[] = [];
    if (!deleted && user.role !== "admin" && !isWaitingForApproval(user)) {
      items.push({ kind: "item", id: "review", label: "Review approval again", onSelect: () => onReview(user) });
    }
    if (!deleted) {
      for (const role of ROLES.filter((option) => option !== user.role)) {
        items.push({ kind: "item", id: `role-${role}`, label: `Make ${ROLE_LABEL[role].toLowerCase()}`, onSelect: () => onChangeRole(user, role) });
      }
    }
    const actions = allowedAccountActions(user);
    if (actions.length > 0 && items.length > 0) items.push({ kind: "divider", id: "divider" });
    for (const action of actions) {
      const words = ACCOUNT_ACTION_TEXT[action];
      items.push({
        kind: "item",
        id: action,
        label: words.label,
        danger: words.tone === "danger",
        onSelect: () => onAccountAction(user, action),
      });
    }
    return items;
  }

  return (
    <section className={styles.panel} aria-label="Users">
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={text("adminSearchUsers", "Search by name or email")}
            aria-label="Search users"
          />
        </label>
        <span className={styles.count} aria-live="polite">
          {users.length === totalCount ? `${totalCount} people` : `${users.length} of ${totalCount} people`}
        </span>
      </div>

      {/* Status filters. Swipe sideways on a phone. */}
      <div className={styles.filters} role="group" aria-label="Show">
        {USER_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cx(styles.filter, filter === option.value && styles.filterOn)}
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label} <span className={styles.filterCount}>{filterCounts[option.value]}</span>
          </button>
        ))}
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={text("adminNoUsers", "No users found")}
          text={filter === "all" ? "Try another name or email." : "Nobody matches this filter and search."}
        />
      ) : (
        <div role="table" aria-label="Users" className={styles.table}>
          <div role="row" className={cx(styles.row, styles.headRow)}>
            <span role="columnheader">Person</span>
            <span role="columnheader">{text("role", "Role")}</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Joined</span>
            <span role="columnheader">Last sign-in</span>
            <span role="columnheader" className={styles.srOnly}>
              Actions
            </span>
          </div>

          {users.map((user) => {
            const busy = busyUserId === user.id;
            const name = displayName(user);
            const note = statusNote(user);
            const deleted = accountState(user) === "deleted";
            const isMe = user.id === myId;
            const items = isMe ? [] : menuFor(user, deleted);
            const waiting = isWaitingForApproval(user);

            return (
              <div role="row" key={user.id} className={cx(styles.row, busy && styles.rowBusy, deleted && styles.rowMuted)}>
                <span role="cell" className={styles.person}>
                  <Avatar name={name} size={40} />
                  <span className={styles.personText}>
                    <strong>
                      {name}
                      {isMe && <span className={styles.you}>You</span>}
                    </strong>
                    <span className={styles.email}>{user.email}</span>
                    {note && <span className={styles.note}>{note}</span>}
                  </span>
                </span>

                <span role="cell" className={styles.roleCell}>
                  <span className={cx(styles.role, styles[`role_${user.role}`])}>{ROLE_LABEL[user.role]}</span>
                </span>

                <span role="cell" className={styles.badges}>
                  <AccountBadge user={user} text={text} />
                  {!deleted && <ApprovalBadge user={user} text={text} />}
                </span>

                <span role="cell" className={styles.date}>
                  <span className={styles.dateLabel}>Joined </span>
                  {formatDate(user.date_joined)}
                </span>
                <span role="cell" className={styles.date}>
                  <span className={styles.dateLabel}>Last sign-in </span>
                  {user.last_login ? formatDate(user.last_login) : "Never"}
                </span>

                <span role="cell" className={styles.actions}>
                  {busy && <span className={styles.saving}>{text("adminUpdating", "Saving...")}</span>}
                  {!busy && waiting && (
                    <button type="button" className="btn-outline btn-sm" onClick={() => onReview(user)}>
                      Review
                    </button>
                  )}
                  {!busy && deleted && items.some((item) => item.id === "restore") && (
                    <button type="button" className="btn-outline btn-sm" onClick={() => onAccountAction(user, "restore")}>
                      {ACCOUNT_ACTION_TEXT.restore.label}
                    </button>
                  )}
                  {items.length > 0 && !deleted && (
                    <RowMenu label={`Manage ${name}'s account`} items={items} disabled={busy} />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
