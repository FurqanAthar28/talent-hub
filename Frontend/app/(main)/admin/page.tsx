"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../../api/client";
import { fetchUiContent, type UiContent } from "../../api/ui-content";

type AdminStats = {
  users: number;
  activeUsers: number;
  inactiveUsers: number;
  staffUsers: number;
  skills: number;
  projects: number;
  experiences: number;
  pendingConnectionRequests: number;
  pendingRecruiters: number;
};

type AdminUser = {
  id: number;
  email: string;
  username: string;
  fullName: string;
  role: "candidate" | "recruiter" | "admin";
  is_active: boolean;
  is_staff: boolean;
  date_joined: string;
  last_login: string | null;
  profileCompletion: number;
  skillsCount: number;
  projectsCount: number;
  experiencesCount: number;
  connectionsCount: number;
  recruiterVerificationStatus: "pending" | "approved" | "rejected";
  recruiterVerificationNote: string;
};

type AdminConnection = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: "candidate" | "recruiter";
  connectedUserId: number;
  connectedUserName: string;
  connectedUserEmail: string;
  connectedUserRole: "candidate" | "recruiter";
  createdAt: string;
};

type AdminAuditLog = {
  id: number;
  actorName: string;
  actorEmail: string;
  targetUserName: string;
  targetUserEmail: string;
  action: string;
  description: string;
  createdAt: string;
};

type AuthUser = {
  isStaff: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getRecruiterVerificationLabel(user: AdminUser, uiContent: UiContent) {
  if (user.role !== "recruiter") return "-";

  const labels = {
    pending: uiContent.adminRecruiterPending,
    approved: uiContent.adminRecruiterApproved,
    rejected: uiContent.adminRecruiterRejected,
  };

  return labels[user.recruiterVerificationStatus];
}

export default function AdminPage() {
  const [uiContent, setUiContent] = useState<UiContent>({});
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [roleLoading, setRoleLoading] = useState<number | null>(null);
  const [verificationLoading, setVerificationLoading] = useState<number | null>(null);
  const [connections, setConnections] = useState<AdminConnection[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [firstUserId, setFirstUserId] = useState("");
  const [secondUserId, setSecondUserId] = useState("");
  const [connectionSaving, setConnectionSaving] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState<number | null>(null);
  const [canViewAdmin, setCanViewAdmin] = useState(false);

  const loadAdminData = useCallback(async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice("");

    try {
      const uiContentData = await fetchUiContent();
      setUiContent(uiContentData);

      const meRes = await apiFetch(uiContentData.apiAccountsMe);

      if (!meRes.ok) {
        setCanViewAdmin(false);
        setNotice(uiContentData.adminAccessDenied);
        return;
      }

      const currentUser = (await meRes.json()) as AuthUser;

      if (!currentUser.isStaff) {
        setCanViewAdmin(false);
        setNotice(uiContentData.adminAccessDenied);
        return;
      }

      setCanViewAdmin(true);

      const [statsRes, usersRes, connectionsRes, auditLogsRes] = await Promise.all([
        apiFetch(uiContentData.apiAdminStats),
        apiFetch(uiContentData.apiAdminUsers),
        apiFetch(uiContentData.apiAdminConnections),
        apiFetch(uiContentData.apiAdminAuditLogs),
      ]);

      if (!statsRes.ok || !usersRes.ok || !connectionsRes.ok || !auditLogsRes.ok) {
        setNotice(uiContentData.adminUnableToLoad);
        return;
      }

      setStats(await statsRes.json());
      setUsers(await usersRes.json());
      setConnections(await connectionsRes.json());
      setAuditLogs(await auditLogsRes.json());
    } catch (error) {
      console.error("Failed to load admin data:", error);
      setCanViewAdmin(false);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setLoading(false);
    }
  }, [uiContent.adminUnableToLoad]);

  useEffect(() => {
    async function loadInitialAdminData() {
      await loadAdminData();
    }

    loadInitialAdminData();
  }, [loadAdminData]);

  const filteredUsers = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) return users;

    return users.filter((user) => {
      return (
        user.fullName.toLowerCase().includes(normalizedSearchTerm) ||
        user.email.toLowerCase().includes(normalizedSearchTerm)
      );
    });
  }, [searchTerm, users]);

  const networkUsers = useMemo(() => {
    return users.filter((user) => {
      return (
        user.is_active &&
        !user.is_staff &&
        (user.role === "candidate" ||
          (user.role === "recruiter" &&
            user.recruiterVerificationStatus === "approved"))
      );
    });
  }, [users]);

  async function updateUserStatus(user: AdminUser) {
    setActionLoading(user.id);
    setNotice("");

    try {
      const res = await apiFetch(
        `${uiContent.apiAdminUsers}/${user.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !user.is_active }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message);
        return;
      }

      setUsers((previousUsers) =>
        previousUsers.map((currentUser) =>
          currentUser.id === user.id ? data : currentUser
        )
      );

      setNotice(data.message || uiContent.adminUserStatusUpdated);
      await loadAdminData(false);
    } catch (error) {
      console.error("Failed to update user status:", error);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setActionLoading(null);
    }
  }

  async function updateUserRole(user: AdminUser, role: AdminUser["role"]) {
    if (role === user.role) {
      setNotice(uiContent.adminNoChangeRequired);
      return;
    }

    setRoleLoading(user.id);
    setNotice("");

    try {
      const res = await apiFetch(
        `${uiContent.apiAdminUsers}/${user.id}/${uiContent.apiAdminUserRoleSuffix}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message);
        return;
      }

      setUsers((previousUsers) =>
        previousUsers.map((currentUser) =>
          currentUser.id === user.id ? data : currentUser
        )
      );

      setNotice(data.message || uiContent.adminUserRoleUpdated);
      await loadAdminData(false);
    } catch (error) {
      console.error("Failed to update user role:", error);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setRoleLoading(null);
    }
  }

  async function updateRecruiterVerification(
    user: AdminUser,
    status: "approved" | "rejected"
  ) {
    if (status === user.recruiterVerificationStatus) {
      setNotice(uiContent.adminNoChangeRequired);
      return;
    }

    setVerificationLoading(user.id);
    setNotice("");

    try {
      const res = await apiFetch(
        `${uiContent.apiAdminUsers}/${user.id}/${uiContent.apiAdminRecruiterVerificationSuffix}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message || uiContent.adminRecruiterVerificationInvalidRole);
        return;
      }

      setUsers((previousUsers) =>
        previousUsers.map((currentUser) =>
          currentUser.id === user.id ? data : currentUser
        )
      );
      setNotice(uiContent.adminRecruiterVerificationUpdated);
      await loadAdminData(false);
    } catch (error) {
      console.error("Failed to update recruiter verification:", error);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setVerificationLoading(null);
    }
  }

  async function createManagedConnection() {
    setNotice("");

    if (!firstUserId || !secondUserId || firstUserId === secondUserId) {
      setNotice(uiContent.adminInvalidConnectionUsers);
      return;
    }

    setConnectionSaving(true);

    try {
      const res = await apiFetch(uiContent.apiAdminConnectUsers, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(firstUserId),
          connectedUserId: Number(secondUserId),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message || uiContent.adminInvalidConnectionUsers);
        return;
      }

      setNotice(uiContent.adminConnectionCreated);
      setFirstUserId("");
      setSecondUserId("");
      await loadAdminData(false);
    } catch (error) {
      console.error("Failed to create managed connection:", error);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setConnectionSaving(false);
    }
  }

  async function disconnectManagedConnection(connection: AdminConnection) {
    setNotice("");
    setDisconnectLoading(connection.id);

    try {
      const res = await apiFetch(uiContent.apiAdminDisconnectUsers, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: connection.userId,
          connectedUserId: connection.connectedUserId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message || uiContent.adminUnableToLoad);
        return;
      }

      setNotice(uiContent.adminConnectionRemoved);
      await loadAdminData(false);
    } catch (error) {
      console.error("Failed to disconnect managed connection:", error);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setDisconnectLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="app-main">
        <div className="container">{uiContent.loading}</div>
      </div>
    );
  }

  if (!canViewAdmin) {
    return (
      <div className="app-main">
        <div className="container">
          <div className="card">
            <div className="card-body text-center">
              <p className="form-error">{notice}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-main">
      <div className="container">
        <div className="dashboard-header">
          <h1>{uiContent.adminDashboard}</h1>
          <p>{uiContent.adminIntro}</p>
        </div>

        {notice && <div className="form-error mb-2">{notice}</div>}

        {stats && (
          <div className="dashboard-stats">
            <div className="dashboard-stat-card">
              <h3>{stats.users}</h3>
              <p>{uiContent.adminUsers}</p>
            </div>

            <div className="dashboard-stat-card">
              <h3>{stats.activeUsers}</h3>
              <p>{uiContent.adminActiveUsers}</p>
            </div>

            <div className="dashboard-stat-card">
              <h3>{stats.inactiveUsers}</h3>
              <p>{uiContent.adminInactiveUsers}</p>
            </div>

            <div className="dashboard-stat-card">
              <h3>{stats.pendingConnectionRequests}</h3>
              <p>{uiContent.adminPendingRequests}</p>
            </div>

            <div className="dashboard-stat-card">
              <h3>{stats.pendingRecruiters}</h3>
              <p>{uiContent.adminPendingRecruiters}</p>
            </div>
          </div>
        )}

        {stats && (
          <div className="dashboard-stats">
            <div className="dashboard-stat-card">
              <h3>{stats.staffUsers}</h3>
              <p>{uiContent.adminStaffUsers}</p>
            </div>

            <div className="dashboard-stat-card">
              <h3>{stats.skills}</h3>
              <p>{uiContent.adminSkills}</p>
            </div>

            <div className="dashboard-stat-card">
              <h3>{stats.projects}</h3>
              <p>{uiContent.adminProjects}</p>
            </div>

            <div className="dashboard-stat-card">
              <h3>{stats.experiences}</h3>
              <p>{uiContent.adminExperiences}</p>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3>{uiContent.adminConnectionManagement}</h3>
            <p className="muted text-sm">{uiContent.adminConnectionManagementIntro}</p>
          </div>

          <div className="card-body">
            <div className="admin-connection-controls">
              <div className="form-group">
                <label>{uiContent.adminFirstUser}</label>
                <select
                  value={firstUserId}
                  onChange={(event) => setFirstUserId(event.target.value)}
                >
                  <option value="">{uiContent.adminSelectUser}</option>
                  {networkUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} - {user.role === "candidate" ? uiContent.candidate : uiContent.recruiter}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{uiContent.adminSecondUser}</label>
                <select
                  value={secondUserId}
                  onChange={(event) => setSecondUserId(event.target.value)}
                >
                  <option value="">{uiContent.adminSelectUser}</option>
                  {networkUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} - {user.role === "candidate" ? uiContent.candidate : uiContent.recruiter}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={createManagedConnection}
                disabled={connectionSaving}
              >
                {connectionSaving
                  ? uiContent.adminCreatingConnection
                  : uiContent.adminCreateConnection}
              </button>
            </div>

            <div className="admin-connection-list">
              {connections.length === 0 ? (
                <p className="text-center muted">{uiContent.adminNoConnections}</p>
              ) : (
                connections.map((connection) => (
                  <div key={connection.id} className="admin-connection-row">
                    <div>
                      <div className="font-semibold">{connection.userName}</div>
                      <div className="text-sm muted">{connection.userEmail}</div>
                      <span className="status-badge">
                        {connection.userRole === "candidate"
                          ? uiContent.candidate
                          : uiContent.recruiter}
                      </span>
                    </div>

                    <div className="admin-connection-arrow">+</div>

                    <div>
                      <div className="font-semibold">{connection.connectedUserName}</div>
                      <div className="text-sm muted">{connection.connectedUserEmail}</div>
                      <span className="status-badge">
                        {connection.connectedUserRole === "candidate"
                          ? uiContent.candidate
                          : uiContent.recruiter}
                      </span>
                    </div>

                    <div className="text-sm muted">
                      {formatDate(connection.createdAt)}
                    </div>

                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() => disconnectManagedConnection(connection)}
                      disabled={disconnectLoading === connection.id}
                    >
                      {disconnectLoading === connection.id
                        ? uiContent.adminDisconnecting
                        : uiContent.adminDisconnect}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{uiContent.adminAuditLogs}</h3>
            <p className="muted text-sm">{uiContent.adminAuditLogsIntro}</p>
          </div>

          <div className="card-body">
            {auditLogs.length === 0 ? (
              <p className="text-center muted">{uiContent.adminNoAuditLogs}</p>
            ) : (
              <div className="admin-audit-list">
                {auditLogs.map((log) => (
                  <div key={log.id} className="admin-audit-row">
                    <div>
                      <div className="text-sm muted">{uiContent.adminAuditAction}</div>
                      <div className="font-semibold">{log.description}</div>
                      <div className="text-xs muted">{log.action}</div>
                    </div>

                    <div>
                      <div className="text-sm muted">{uiContent.adminAuditActor}</div>
                      <div>{log.actorName}</div>
                      <div className="text-xs muted">{log.actorEmail}</div>
                    </div>

                    <div>
                      <div className="text-sm muted">{uiContent.adminAuditTarget}</div>
                      <div>{log.targetUserName || "-"}</div>
                      <div className="text-xs muted">{log.targetUserEmail}</div>
                    </div>

                    <div>
                      <div className="text-sm muted">{uiContent.adminAuditTime}</div>
                      <div>{formatDate(log.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex-between">
            <h3>{uiContent.adminUsers}</h3>

            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={uiContent.adminSearchPlaceholder}
              className="admin-search-input"
            />
          </div>

          <div className="card-body">
            {filteredUsers.length === 0 ? (
              <p className="text-center muted">{uiContent.adminNoUsers}</p>
            ) : (
              <div className="admin-user-list">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="admin-user-row">
                    <div>
                      <div className="font-semibold">{user.fullName}</div>
                      <div className="text-sm muted">{user.email}</div>
                    </div>

                    <div className="text-sm">
                      <div>{uiContent.adminJoined}</div>
                      <div className="muted">{formatDate(user.date_joined)}</div>
                    </div>

                    <div className="text-sm">
                      <div>{uiContent.adminLastLogin}</div>
                      <div className="muted">{formatDate(user.last_login)}</div>
                    </div>

                    <div className="text-sm">
                      <div>{uiContent.adminProfileCompletion}</div>
                      <div className="muted">{user.profileCompletion}%</div>
                    </div>

                    <div className="text-sm">
                      <div>{uiContent.adminContent}</div>
                      <div className="muted">
                        {user.skillsCount} / {user.projectsCount} /{" "}
                        {user.experiencesCount}
                      </div>
                    </div>

                    <div className="text-sm">
                      <div>{uiContent.adminRole}</div>
                      <select
                        value={user.role}
                        onChange={(event) =>
                          updateUserRole(
                            user,
                            event.target.value as AdminUser["role"]
                          )
                        }
                        disabled={roleLoading === user.id}
                      >
                        <option value="candidate">{uiContent.candidate}</option>
                        <option value="recruiter">{uiContent.recruiter}</option>
                        <option value="admin">{uiContent.adminRole}</option>
                      </select>
                    </div>

                    <div className="text-sm">
                      <div>{uiContent.adminRecruiterVerification}</div>
                      <div className="muted">
                        {getRecruiterVerificationLabel(user, uiContent)}
                      </div>
                      {user.role === "recruiter" && (
                        <div className="admin-inline-actions">
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={() =>
                              updateRecruiterVerification(user, "approved")
                            }
                            disabled={
                              verificationLoading === user.id ||
                              user.recruiterVerificationStatus === "approved"
                            }
                          >
                            {verificationLoading === user.id
                              ? uiContent.adminVerifyingRecruiter
                              : uiContent.adminApproveRecruiter}
                          </button>
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={() =>
                              updateRecruiterVerification(user, "rejected")
                            }
                            disabled={
                              verificationLoading === user.id ||
                              user.recruiterVerificationStatus === "rejected"
                            }
                          >
                            {verificationLoading === user.id
                              ? uiContent.adminVerifyingRecruiter
                              : uiContent.adminRejectRecruiter}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-sm">
                      <div>{uiContent.adminStatus}</div>
                      <div className="muted">
                        {user.is_active
                          ? uiContent.adminActive
                          : uiContent.adminInactive}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      disabled={actionLoading === user.id}
                      onClick={() => updateUserStatus(user)}
                    >
                      {actionLoading === user.id
                        ? uiContent.adminUpdating
                        : user.is_active
                          ? uiContent.adminDeactivate
                          : uiContent.adminActivate}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
