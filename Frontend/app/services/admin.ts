/**
 * Talking to Django's admin API.
 * Each function throws an Error with Django's own message when something
 * goes wrong, so the page can simply show `error.message`.
 */

import type {
  AdminAuditLog,
  AdminConnection,
  AdminMe,
  AdminReport,
  AdminStats,
  AdminUiContentItem,
  AdminUser,
  ApprovalReview,
  ReportAction,
} from "../(main)/admin/types";
import type { RejectionReason } from "../config/constants";
import type { Job } from "./jobs";
import { apiFetch, getApiMessage, readJson } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";

/** Send a request and give back Django's JSON, or stop with its message. */
async function request<T>(path: string, init?: RequestInit): Promise<T & { message?: string }> {
  const response = await apiFetch(path, init);
  // readJson never crashes, even if Django sent an HTML error page.
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(getApiMessage(data) || "The admin request failed. Please try again.");
  }

  return data as T & { message?: string };
}

/** The same, for lists (an empty list if Django sent something else). */
async function requestList<T>(path: string): Promise<T[]> {
  const response = await apiFetch(path);
  if (!response.ok) {
    const data = await readJson(response);
    throw new Error(getApiMessage(data) || "Couldn't load the admin data.");
  }
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

function jsonBody(method: "PATCH" | "POST", body: object): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// ---------- Loading ----------

export const getStats = () => request<AdminStats>(API_ROUTES.ADMIN.STATS);
export const getMyAdminProfile = () => request<AdminMe>(API_ROUTES.ADMIN.ME);
export const getUsers = () => requestList<AdminUser>(API_ROUTES.ADMIN.USERS);
export const getConnections = () => requestList<AdminConnection>(API_ROUTES.ADMIN.CONNECTIONS);
export const getAuditLogs = () => requestList<AdminAuditLog>(API_ROUTES.ADMIN.AUDIT_LOGS);
export const getUiContentItems = () => requestList<AdminUiContentItem>(API_ROUTES.ADMIN.UI_CONTENT);

// ---------- Changing things (each gives back the updated item + a message) ----------

/** Must match AccountActionSerializer in Backend/admin_panel/serializers.py. */
export type AccountAction = "suspend" | "unsuspend" | "ban" | "unban" | "delete" | "restore";

/** Suspend, ban, delete (restorable) or undo one. Suspend, ban and delete need a reason. */
export const runAccountAction = (userId: number, action: AccountAction, reason = "") =>
  request<AdminUser>(API_ROUTES.ADMIN.ACCOUNT_ACTION(userId), jsonBody("POST", { action, reason }));

export const setUserRole = (userId: number, role: AdminUser["role"]) =>
  request<AdminUser>(API_ROUTES.ADMIN.USER_ROLE(userId), jsonBody("PATCH", { role }));

/** Every approval check for one person, plus the reasons allowed for "not approved". */
export const getApprovalReview = (userId: number) => request<ApprovalReview>(API_ROUTES.ADMIN.APPROVAL_CHECKS(userId));

export type ApprovalDecision =
  | { status: "approved"; linkedinChecked: boolean }
  | { status: "rejected"; reason: RejectionReason };

/** Approve someone, or "not approved" with one of the two fixed reasons (they see it). */
export const decideApproval = (userId: number, decision: ApprovalDecision) =>
  request<AdminUser>(API_ROUTES.ADMIN.APPROVAL(userId), jsonBody("PATCH", decision));

export const connectUsers = (userId: number, connectedUserId: number) =>
  request<AdminConnection>(API_ROUTES.ADMIN.CONNECT_USERS, jsonBody("POST", { userId, connectedUserId }));

export const disconnectUsers = (userId: number, connectedUserId: number) =>
  request<object>(API_ROUTES.ADMIN.DISCONNECT_USERS, jsonBody("POST", { userId, connectedUserId }));

export const updateUiContentItem = (key: string, value: string) =>
  request<AdminUiContentItem>(API_ROUTES.ADMIN.UI_CONTENT_ITEM(key), jsonBody("PATCH", { value }));

// ---------- Job posts ----------

export const getAdminJobs = () => requestList<Job>(API_ROUTES.ADMIN.JOBS);

/** Hide a job (the reason is shown to the recruiter) or show it again. */
export const setJobHidden = (jobId: number, hidden: boolean, reason = "") =>
  request<Job>(API_ROUTES.ADMIN.JOB_VISIBILITY(jobId), jsonBody("POST", { hidden, reason }));

// ---------- Reports ----------

export const getReports = (status: "open" | "closed") => requestList<AdminReport>(API_ROUTES.ADMIN.REPORTS(status));

/**
 * Close a report. Suspend and ban need a note (the person sees it, like on the
 * Users page) and also close every other open report about that person.
 */
export const resolveReport = (reportId: number, action: ReportAction, note = "") =>
  request<AdminReport & { closedOthers?: number }>(
    API_ROUTES.ADMIN.REPORT_RESOLVE(reportId),
    jsonBody("POST", { action, note })
  );

// ---------- Shared rules (the admin page and the admin profile both use these) ----------

/**
 * One word for where an account stands. Deleted wins (a deleted, banned
 * account shows as deleted); "unverified" = never confirmed their email.
 */
export type AccountState = "active" | "unverified" | "suspended" | "banned" | "deleted";

export function accountState(user: AdminUser): AccountState {
  if (user.deletedAt) return "deleted";
  if (user.accountStatus === "banned") return "banned";
  if (user.accountStatus === "suspended") return "suspended";
  return user.is_active ? "active" : "unverified";
}

/** Still restorable? (Same rule as within_grace_period() in Django.) */
export const canStillRestore = (user: AdminUser) =>
  Boolean(user.restoreUntil && new Date(user.restoreUntil).getTime() > Date.now());

/**
 * Which buttons make sense for this account right now. Same rules as
 * ACCOUNT_ACTIONS in Backend/admin_panel/views.py (Django checks again).
 */
export function allowedAccountActions(user: AdminUser): AccountAction[] {
  if (user.deletedAt) return canStillRestore(user) ? ["restore"] : [];
  if (user.accountStatus === "banned") return ["unban", "delete"];
  if (user.accountStatus === "suspended") return ["unsuspend", "ban", "delete"];
  return ["suspend", "ban", "delete"];
}

/** Days left until `until`, counting a started day as a day (30 right after deleting; 0 = time is up). */
export function daysLeft(until: string | null): number {
  if (!until) return 0;
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / DAY_MS));
}

/** The name to show for a person: their full name, or their email if they have none. */
export const displayName = (user: Pick<AdminUser, "fullName" | "email">) => user.fullName || user.email;

/** A switched-on candidate or recruiter waiting for an admin's decision. */
export const isWaitingForApproval = (user: AdminUser) =>
  user.is_active && user.role !== "admin" && user.approvalStatus === "pending";

/**
 * Can this person be connected? Same rule as network_users() in Django
 * (connections/network.py): switched on, and an APPROVED candidate or recruiter.
 */
export const isNetworkUser = (user: AdminUser) =>
  user.is_active && !user.is_staff && user.role !== "admin" && user.approvalStatus === "approved";
