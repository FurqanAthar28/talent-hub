/**
 * Talking to Django's admin API.
 * Each function throws an Error with Django's own message when something
 * goes wrong, so the page can simply show `error.message`.
 */

import type {
  AdminAuditLog,
  AdminConnection,
  AdminMe,
  AdminStats,
  AdminUiContentItem,
  AdminUser,
} from "../(main)/admin/types";
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

export const setUserActive = (userId: number, isActive: boolean) =>
  request<AdminUser>(API_ROUTES.ADMIN.USER_STATUS(userId), jsonBody("PATCH", { is_active: isActive }));

export const setUserRole = (userId: number, role: AdminUser["role"]) =>
  request<AdminUser>(API_ROUTES.ADMIN.USER_ROLE(userId), jsonBody("PATCH", { role }));

/** Approve or reject a recruiter. The note is shown to the recruiter on their dashboard. */
export const setRecruiterVerification = (userId: number, status: "approved" | "rejected", note = "") =>
  request<AdminUser>(API_ROUTES.ADMIN.RECRUITER_VERIFICATION(userId), jsonBody("PATCH", { status, note }));

export const connectUsers = (userId: number, connectedUserId: number) =>
  request<AdminConnection>(API_ROUTES.ADMIN.CONNECT_USERS, jsonBody("POST", { userId, connectedUserId }));

export const disconnectUsers = (userId: number, connectedUserId: number) =>
  request<object>(API_ROUTES.ADMIN.DISCONNECT_USERS, jsonBody("POST", { userId, connectedUserId }));

export const updateUiContentItem = (key: string, value: string) =>
  request<AdminUiContentItem>(API_ROUTES.ADMIN.UI_CONTENT_ITEM(key), jsonBody("PATCH", { value }));
